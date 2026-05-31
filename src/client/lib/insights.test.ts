import { describe, expect, it } from "vitest";
import type { AppMe, ChatAnswer, ClientProfile, PlanItem, WikiPage } from "../../shared/types";
import type { ConversationEntry } from "./types";
import {
  categoryFor,
  cleanCitationExcerpt,
  followUpPrompts,
  friendlyEntity,
  impactCopy,
  isActive,
  isNewPage,
  nextDeadline,
  planCommitment,
  readable,
  readableState,
  readinessScore,
  suggestedPrompts,
  titleForPath
} from "./insights";

function makeClient(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: "c1",
    tenantId: "t1",
    email: "client@example.com",
    name: "Demo Client",
    tier: "mid",
    entityType: "s_corp",
    lifecycleStage: "active",
    tags: [],
    hasChildren: false,
    accessStatus: "active",
    ...overrides
  };
}

function makeMe(client: ClientProfile | null): AppMe {
  return { authenticated: true, role: "client", client, adminEmail: null };
}

function makeAnswer(overrides: Partial<ChatAnswer> = {}): ChatAnswer {
  return {
    conversationId: "conv1",
    answer: "Some grounded answer.",
    state: "answered_with_citations",
    citations: [],
    recommendedTrainings: [],
    nextSteps: [],
    confidence: 0.8,
    escalationRequired: false,
    escalationReason: null,
    sourceDates: [],
    modelId: "test",
    promptVersion: "v1",
    ...overrides
  };
}

describe("readable / friendlyEntity", () => {
  it("converts kebab and snake case to spaced words", () => {
    expect(readable("hire-kids")).toBe("hire kids");
    expect(readable("s_corp")).toBe("s corp");
  });

  it("falls back to 'not set' for empty input", () => {
    expect(readable(undefined)).toBe("not set");
  });

  it("maps unknown entity to a plain-language placeholder", () => {
    expect(friendlyEntity("unknown")).toBe("Business details pending");
    expect(friendlyEntity("s_corp")).toBe("s corp");
  });
});

describe("readableState", () => {
  it("maps known answer states to client-facing labels", () => {
    expect(readableState("answered_with_citations")).toBe("Answer from approved sources");
    expect(readableState("cpa_review_recommended")).toBe("Recommended for expert review");
  });

  it("falls back to a readable form for unknown states", () => {
    expect(readableState("some_new_state")).toBe("some new state");
  });
});

describe("readinessScore", () => {
  it("returns the base score when there is no profile context", () => {
    expect(readinessScore(makeMe(null), [])).toBe(52);
  });

  it("adds weighted bonuses for entity, tags, children, and history", () => {
    const me = makeMe(makeClient({ entityType: "s_corp", tags: ["a", "b"], hasChildren: true }));
    const history = [{ id: "1" }] as unknown as ConversationEntry[];
    // 52 + 12 (entity) + 12 (2 tags * 6) + 6 (children) + 3 (1 history) = 85
    expect(readinessScore(me, history)).toBe(85);
  });

  it("never exceeds the ceiling of 96", () => {
    const me = makeMe(makeClient({ tags: ["a", "b", "c", "d", "e"], hasChildren: true }));
    const history = Array.from({ length: 20 }, (_, i) => ({ id: String(i) })) as unknown as ConversationEntry[];
    expect(readinessScore(me, history)).toBe(96);
  });
});

describe("suggestedPrompts", () => {
  it("prioritizes the hire-kids prompt when the client has children", () => {
    const prompts = suggestedPrompts(makeMe(makeClient({ hasChildren: true })));
    expect(prompts[0]).toContain("hire my kids");
  });

  it("surfaces the Augusta prompt for augusta-rule clients", () => {
    const prompts = suggestedPrompts(makeMe(makeClient({ tags: ["augusta-rule"] })));
    expect(prompts.some((p) => p.includes("Augusta Rule"))).toBe(true);
  });

  it("caps the list at five prompts", () => {
    const prompts = suggestedPrompts(makeMe(makeClient({ tags: ["augusta-rule"], hasChildren: true })));
    expect(prompts.length).toBeLessThanOrEqual(5);
  });
});

describe("titleForPath", () => {
  it("derives a per-section document title", () => {
    expect(titleForPath("/admin/review")).toBe("Admin | Ask Advisor");
    expect(titleForPath("/learn/some-slug")).toBe("Learn | Ask Advisor");
    expect(titleForPath("/anything-else")).toBe("Ask | Ask Advisor");
  });
});

describe("isActive", () => {
  it("treats root and /ask as the Ask tab", () => {
    expect(isActive("/", "/ask")).toBe(true);
    expect(isActive("/ask", "/ask")).toBe(true);
  });

  it("keeps Learn active on lesson detail routes", () => {
    expect(isActive("/learn/slug", "/learn")).toBe(true);
  });

  it("keeps Account active on history", () => {
    expect(isActive("/history", "/more")).toBe(true);
  });
});

describe("nextDeadline", () => {
  it("returns a quarterly tax landmark with a non-negative countdown", () => {
    const result = nextDeadline();
    expect(result.days).toBeGreaterThanOrEqual(0);
    expect(result.label).toMatch(/^(January|April|June|September) 15$/);
  });
});

describe("impactCopy / followUpPrompts", () => {
  it("returns savings-framed copy for a cited answer", () => {
    expect(impactCopy(makeAnswer())).toContain("lose savings");
  });

  it("returns review-framed copy when escalation is required", () => {
    expect(impactCopy(makeAnswer({ state: "cpa_review_recommended", escalationRequired: true }))).toContain("review");
  });

  it("tailors follow-ups to the question topic", () => {
    expect(followUpPrompts("hiring my kids", makeAnswer())).toContain("What documents should I gather first?");
    expect(followUpPrompts("estimated taxes", makeAnswer())).toContain("What numbers should I bring?");
  });
});

describe("cleanCitationExcerpt", () => {
  it("strips markdown headings and collapses whitespace", () => {
    expect(cleanCitationExcerpt("## Heading\n\nSome    text\nhere")).toBe("Heading Some text here");
  });
});

describe("categoryFor", () => {
  it("maps strategy keys to display categories", () => {
    expect(categoryFor("hire-kids")).toBe("People");
    expect(categoryFor("estimated-taxes")).toBe("Tax Readiness");
    expect(categoryFor("augusta-rule")).toBe("Home & Office");
    expect(categoryFor("mystery-key")).toBe("Strategy");
  });
});

describe("isNewPage", () => {
  const base = { id: "w1", slug: "s", title: "t", summary: "" } as unknown as WikiPage;

  it("is true within the two-week window", () => {
    expect(isNewPage({ ...base, publishedAt: new Date().toISOString() })).toBe(true);
  });

  it("is false for older pages", () => {
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    expect(isNewPage({ ...base, publishedAt: old, updatedAt: old })).toBe(false);
  });

  it("is false when no timestamp is present", () => {
    expect(isNewPage(base)).toBe(false);
  });
});

describe("planCommitment", () => {
  const base = { title: "t", done: false, reason: "", strategyKey: "estimated-taxes" } as PlanItem;

  it("acknowledges completed items", () => {
    expect(planCommitment({ ...base, done: true })).toContain("Completed");
  });

  it("gives a strategy-specific gather cue", () => {
    expect(planCommitment(base)).toContain("year-to-date income");
    expect(planCommitment({ ...base, strategyKey: "hire-kids" })).toContain("pay rate");
  });
});
