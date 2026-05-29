import { describe, expect, it } from "vitest";
import { redactSensitive, retrieveChunks } from "./knowledge";
import { allowedVisibilityTiers, queryVectorScores, upsertPublishedWikiVectors } from "./vector";
import type { ClientProfile } from "../shared/types";

describe("redactSensitive", () => {
  it("removes common sensitive values from escalation summaries", () => {
    const text = "Email client@example.com, phone 404-555-1212, SSN 123-45-6789, EIN 12-3456789.";
    expect(redactSensitive(text)).toBe(
      "Email [redacted-email], phone [redacted-phone], SSN [redacted-ssn], EIN [redacted-ein]."
    );
  });
});

describe("allowedVisibilityTiers", () => {
  it("does not expose higher-tier knowledge to lower-tier clients", () => {
    expect(allowedVisibilityTiers("low")).toEqual(["all", "low"]);
    expect(allowedVisibilityTiers("mid")).toEqual(["all", "low", "mid"]);
    expect(allowedVisibilityTiers("high")).toEqual(["all", "low", "mid", "high"]);
  });
});

describe("queryVectorScores", () => {
  it("falls back to an empty score map when Vectorize is unavailable locally", async () => {
    const env = {
      AI: {
        run: async () => ({ data: [[0.1, 0.2, 0.3]] })
      },
      VECTOR_INDEX: {
        query: async () => {
          throw new Error("Binding VECTOR_INDEX needs to be run remotely");
        }
      }
    } as unknown as Env;
    const client = {
      tier: "mid",
      tags: [],
      entityType: "s_corp",
      lifecycleStage: "active"
    } as unknown as ClientProfile;
    const scores = await queryVectorScores(env, client, "Should I hire my kids?");
    expect(scores.size).toBe(0);
  });
});

describe("retrieveChunks", () => {
  it("keeps clear strategy questions scoped to the matched strategy", async () => {
    const rows = [
      chunk("chunk_minister", "ministerial-housing-allowance", "Ministerial housing allowance setup checklist and fair rental value support."),
      chunk("chunk_kids", "hire-kids", "Hiring kids setup checklist and payroll support.")
    ];
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ results: rows })
          })
        })
      }
    } as unknown as Env;
    const client = {
      tier: "mid",
      tags: [],
      entityType: "unknown",
      lifecycleStage: "active",
      hasChildren: true
    } as unknown as ClientProfile;

    const retrieved = await retrieveChunks(env, client, "What exactly do I need to set up for ministerial housing allowance?");

    expect(retrieved.map((item) => item.row.strategy_key)).toEqual(["ministerial-housing-allowance"]);
  });
});

function chunk(id: string, strategyKey: string, text: string) {
  return {
    id,
    tenant_id: "tenant_beyond_freedom",
    wiki_page_id: `wiki_${strategyKey}`,
    source_id: `src_${strategyKey}`,
    vector_id: `vector_${id}`,
    text,
    citation_json: JSON.stringify({
      sourceId: `src_${strategyKey}`,
      wikiPageId: `wiki_${strategyKey}`,
      sourceTitle: strategyKey,
      sourceType: "training",
      quoteSpan: text,
      clientVisibleUrl: `/learn/${strategyKey}`
    }),
    published: 1,
    visibility: "client",
    visibility_tier: "all",
    source_type: "training",
    strategy_key: strategyKey,
    effective_year: "2026",
    requires_review: 0,
    content_version: "v1"
  };
}

describe("upsertPublishedWikiVectors", () => {
  it("keeps publication usable when Vectorize upsert is unavailable locally", async () => {
    const env = {
      AI: {
        run: async () => ({ data: [[0.1, 0.2, 0.3]] })
      },
      VECTOR_INDEX: {
        upsert: async () => {
          throw new Error("Vectorize Index bindings do not support local development");
        }
      },
      DB: {
        prepare: (sql: string) => ({
          bind: (..._binds: unknown[]) => ({
            all: async () => ({
              results: sql.includes("FROM knowledge_chunks")
                ? [
                    {
                      id: "chunk_1",
                      tenant_id: "tenant_beyond_freedom",
                      wiki_page_id: "wiki_1",
                      source_id: "src_1",
                      vector_id: "vector_chunk_1",
                      text: "Approved source text",
                      published: 1,
                      visibility: "client",
                      visibility_tier: "mid",
                      source_type: "training",
                      strategy_key: "owner-draws",
                      effective_year: "2026",
                      content_version: "v1"
                    }
                  ]
                : []
            }),
            run: async () => ({ success: true })
          })
        })
      }
    } as unknown as Env;

    await expect(upsertPublishedWikiVectors(env, "wiki_1", "test")).resolves.toBe(0);
  });
});
