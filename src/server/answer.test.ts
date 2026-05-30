import { afterEach, describe, expect, it, vi } from "vitest";
import { answerQuestion, retrieveChunks } from "./knowledge";
import type { ClientProfile } from "../shared/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const client: ClientProfile = {
  id: "client_1",
  tenantId: "tenant_beyond_freedom",
  email: "client@example.com",
  name: "Demo Client",
  tier: "mid",
  entityType: "s_corp",
  lifecycleStage: "active",
  tags: ["hire-kids"],
  hasChildren: true,
  accessStatus: "active"
};

function citation(strategyKey = "hire-kids") {
  return {
    sourceId: `src_${strategyKey}`,
    sourceTitle: strategyKey === "hire-kids" ? "Hiring Your Kids Strategy Training" : "Estimated Tax Reminder Email",
    sourceType: "training",
    wikiPageId: `wiki_${strategyKey}`,
    quoteSpan: "Approved quote",
    timestamp: null,
    clientVisibleUrl: `/trainings/${strategyKey}`,
    confidence: 0.9
  };
}

function chunk(overrides: Record<string, unknown> = {}) {
  const strategyKey = String(overrides.strategy_key || "hire-kids");
  return {
    id: `chunk_${strategyKey}`,
    tenant_id: "tenant_beyond_freedom",
    wiki_page_id: `wiki_${strategyKey}`,
    source_id: `src_${strategyKey}`,
    vector_id: `vector_${strategyKey}`,
    text:
      "Hiring your children can be a valuable family tax strategy when the child performs real work, the pay is reasonable, and the business keeps clean documentation. Parents should track hours and use compliant payroll when required.",
    citation_json: JSON.stringify(citation(strategyKey)),
    published: 1,
    visibility: "client",
    visibility_tier: "mid",
    source_type: "training",
    strategy_key: strategyKey,
    effective_year: "2026",
    requires_review: 0,
    content_version: "v1",
    ...overrides
  };
}

function createAnswerEnv(rows: unknown[]) {
  const inserts: Array<{ sql: string; binds: unknown[] }> = [];
  const env = {
    AI: {
      run: async () => {
        throw new Error("AI unavailable in unit test");
      }
    },
    VECTOR_INDEX: {
      query: async () => {
        throw new Error("Vectorize unavailable in unit test");
      }
    },
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          all: async () => ({ results: sql.includes("FROM knowledge_chunks") ? rows : [] }),
          run: async () => {
            inserts.push({ sql, binds });
            return { success: true };
          },
          first: async () => null
        })
      })
    }
  } as unknown as Env;
  return { env, inserts };
}

describe("retrieveChunks", () => {
  it("does not retrieve unrelated profile-tagged chunks without question overlap", async () => {
    const { env } = createAnswerEnv([
      chunk({
        strategy_key: "estimated-taxes",
        text: "Estimated tax planning should happen before the deadline, not after."
      })
    ]);

    const retrieved = await retrieveChunks(env, client, "What should I understand before hiring my kids?");
    expect(retrieved).toHaveLength(0);
  });

  it("boosts strategy-specific matches above generic employment content", async () => {
    const { env } = createAnswerEnv([
      chunk({
        strategy_key: "retirement-plans",
        text: "Small business retirement plans require gathering employee census details, compensation, and contribution goals."
      }),
      chunk({
        strategy_key: "hire-kids",
        text: "Hiring your children requires real work, reasonable pay, clean documentation, and payroll review before acting."
      })
    ]);

    const retrieved = await retrieveChunks(env, client, "Should I hire my kids?");
    expect(retrieved[0].row.strategy_key).toBe("hire-kids");
  });
});

describe("answerQuestion", () => {
  it("returns cited educational guidance for supported questions", async () => {
    const { env, inserts } = createAnswerEnv([chunk()]);
    const answer = await answerQuestion(env, client, "Explain the hire kids strategy basics.");

    expect(answer.state).toBe("answered_with_citations");
    expect(answer.escalationRequired).toBe(false);
    expect(answer.citations).toHaveLength(1);
    expect(answer.recommendedTrainings[0].title).toBe("Hiring Your Kids Strategy Training");
    expect(answer.nextSteps).toContain("Prepare the job description, time records, pay rate support, and payroll path before hiring a child.");
    expect(inserts.some((item) => item.sql.includes("INSERT INTO conversations"))).toBe(true);
  });

  it("routes generation through AI Gateway when it is configured", async () => {
    const { env } = createAnswerEnv([chunk()]);
    env.AI_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions";
    env.AI_GATEWAY_TOKEN = "gateway_test";
    env.AI_GATEWAY_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "Gateway grounded answer based only on the approved source excerpt. It reminds the client to document work and compare facts before acting."
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const answer = await answerQuestion(env, client, "Explain the hire kids strategy basics.");

    expect(answer.modelId).toBe("ai-gateway/@cf/meta/llama-3.1-8b-instruct-fp8");
    expect(answer.answer).toContain("Gateway grounded answer");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer gateway_test",
          "Content-Type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const requestBody = JSON.parse(String(calls[0][1].body));
    expect(requestBody.model).toBe("@cf/meta/llama-3.1-8b-instruct-fp8");
    expect(requestBody.messages[0].content).toContain("Use only the approved source excerpts provided.");
  });

  it("falls back to the local source extractor when AI Gateway fails", async () => {
    const { env } = createAnswerEnv([chunk()]);
    env.AI_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions";
    env.AI_GATEWAY_TOKEN = "gateway_test";
    globalThis.fetch = vi.fn(async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch;

    const answer = await answerQuestion(env, client, "Explain the hire kids strategy basics.");

    expect(answer.modelId).toBe("source-grounded-local-extractor");
    expect(answer.answer).toContain("Based on the approved Beyond Freedom materials");
  });

  it("escalates unsupported questions instead of inventing an answer", async () => {
    const { env } = createAnswerEnv([]);
    const answer = await answerQuestion(env, client, "Can you guarantee my IRS audit outcome?");

    expect(answer.state).toBe("cannot_answer_from_approved_sources");
    expect(answer.escalationRequired).toBe(true);
    expect(answer.citations).toHaveLength(0);
    expect(answer.answer).toContain("could not find enough approved Beyond Freedom material");
    expect(answer.escalationReason).toBe("No approved source supports a client-facing answer.");
  });

  it("requires review for high-risk tax questions even when a source matches", async () => {
    const { env } = createAnswerEnv([chunk()]);
    const answer = await answerQuestion(env, client, "Will this hire kids strategy guarantee no IRS penalty?");

    expect(answer.state).toBe("cpa_review_recommended");
    expect(answer.escalationRequired).toBe(true);
    expect(answer.escalationReason).toContain("high-risk");
  });

  it("requires review for S-corp distribution questions", async () => {
    const { env } = createAnswerEnv([
      chunk({
        strategy_key: "s-corp-compensation",
        text: "S-corp shareholder-employees must consider reasonable compensation for services before non-wage distributions."
      })
    ]);
    const answer = await answerQuestion(env, client, "Can I only take S-corp distributions?");

    expect(answer.state).toBe("cpa_review_recommended");
    expect(answer.escalationRequired).toBe(true);
    expect(answer.citations[0].sourceId).toBe("src_s-corp-compensation");
  });

  it("requires review for worker classification questions", async () => {
    const { env } = createAnswerEnv([
      chunk({
        strategy_key: "worker-classification",
        text: "Worker classification depends on behavioral control, financial control, and the relationship of the parties."
      })
    ]);
    const answer = await answerQuestion(env, client, "Should I classify this worker as a contractor?");

    expect(answer.state).toBe("cpa_review_recommended");
    expect(answer.escalationRequired).toBe(true);
  });
});
