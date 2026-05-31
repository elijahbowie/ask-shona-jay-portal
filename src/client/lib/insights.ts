import type { AppMe, ChatAnswer, PlanItem, WikiPage } from "../../shared/types";
import type { ConversationEntry } from "./types";

const DAY_MS = 86_400_000;

// Tax-readiness scoring weights. The score is a descriptive planning signal
// (see design/RATIONALE.md §4), never a qualification gate.
const READINESS = {
  base: 52,
  entityBonus: 12,
  tagBonusPer: 6,
  tagBonusMax: 18,
  childrenBonus: 6,
  historyBonusPer: 3,
  historyBonusMax: 12,
  ceiling: 96
} as const;

// A lesson counts as "new" for two weeks after it is published or updated.
const NEW_PAGE_WINDOW_MS = 14 * DAY_MS;

export function readable(value?: string): string {
  return (value || "not set").replace(/[-_]/g, " ");
}

export function friendlyEntity(value?: string): string {
  const normalized = readable(value);
  return normalized === "unknown" ? "Business details pending" : normalized;
}

export function readableState(state: string): string {
  const labels: Record<string, string> = {
    answered_with_citations: "Answer from approved sources",
    needs_more_context: "Shona may need more details",
    cpa_review_recommended: "Recommended for expert review",
    cannot_answer_from_approved_sources: "Shona will find the answer",
    escalated_to_team: "Sent to Shona's team"
  };
  return labels[state] || readable(state);
}

export function suggestedPrompts(me: AppMe): string[] {
  const tags = new Set(me.client?.tags || []);
  const prompts = [
    "What should I do before estimated taxes are due?",
    "Which Learn pages should I review before my next strategy call?",
    "What documents should I gather before asking Shona to review this?"
  ];
  if (tags.has("hire-kids") || me.client?.hasChildren) {
    prompts.unshift("Should I hire my kids, and what facts should I gather first?");
  }
  if (tags.has("augusta-rule")) {
    prompts.unshift("How do I document renting my home to my business (the Augusta Rule)?");
  }
  return prompts.slice(0, 5);
}

export function titleForPath(path: string): string {
  if (path.startsWith("/admin")) {
    return "Admin | Ask Advisor";
  }
  if (path.startsWith("/learn")) {
    return "Learn | Ask Advisor";
  }
  if (path.startsWith("/my-plan")) {
    return "My Plan | Ask Advisor";
  }
  if (path.startsWith("/more")) {
    return "More | Ask Advisor";
  }
  return "Ask | Ask Advisor";
}

export function isActive(path: string, href: string): boolean {
  if (href === "/ask") {
    return path === "/" || path === "/ask";
  }
  if (href === "/learn") {
    return path.startsWith("/learn") || path.startsWith("/trainings");
  }
  if (href === "/my-plan") {
    return path === "/my-plan" || path === "/plan";
  }
  if (href === "/more") {
    return path === "/more" || path === "/account" || path === "/history";
  }
  return path === href;
}

export function readinessScore(me: AppMe, history: ConversationEntry[]): number {
  let score = READINESS.base;
  if (me.client?.entityType && me.client.entityType !== "unknown") score += READINESS.entityBonus;
  if (me.client?.tags?.length) score += Math.min(READINESS.tagBonusMax, me.client.tags.length * READINESS.tagBonusPer);
  if (me.client?.hasChildren) score += READINESS.childrenBonus;
  if (history.length) score += Math.min(READINESS.historyBonusMax, history.length * READINESS.historyBonusPer);
  return Math.min(READINESS.ceiling, score);
}

export function nextDeadline(): { label: string; days: number } {
  const now = new Date();
  const year = now.getFullYear();
  const dates = [
    new Date(year, 3, 15),
    new Date(year, 5, 15),
    new Date(year, 8, 15),
    new Date(year + 1, 0, 15)
  ];
  const target = dates.find((date) => date.getTime() > now.getTime()) || dates[dates.length - 1];
  return {
    label: target.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    days: Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS))
  };
}

export function impactCopy(answer: ChatAnswer): string {
  if (answer.state === "answered_with_citations") {
    return "Businesses like yours often lose savings when documentation waits until year-end.";
  }
  if (answer.escalationRequired) {
    return "A quick review now can prevent a wrong filing, payroll, or entity decision later.";
  }
  return "Use this as a fact-gathering step before Shona/Jay make a recommendation.";
}

export function cleanCitationExcerpt(input: string): string {
  return input
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function followUpPrompts(question: string, answer: ChatAnswer): string[] {
  const lower = `${question} ${answer.answer}`.toLowerCase();
  if (lower.includes("kid") || lower.includes("payroll")) {
    return ["What documents should I gather first?", "When should Shona/Jay review this?", "What common mistakes should I avoid?"];
  }
  if (lower.includes("augusta") || lower.includes("rental")) {
    return ["What should be in the agenda?", "What proof of rental value should I keep?", "When does this need expert review?"];
  }
  if (lower.includes("estimated")) {
    return ["What numbers should I bring?", "What changed since last quarter?", "Which Learn page explains this?"];
  }
  return ["What facts would make this answer stronger?", "Which Learn page should I open?", "Should Shona/Jay review this?"];
}

export function categoryFor(strategyKey: string): string {
  if (strategyKey.includes("kid") || strategyKey.includes("classification")) return "People";
  if (strategyKey.includes("estimated") || strategyKey.includes("qbi")) return "Tax Readiness";
  if (strategyKey.includes("home") || strategyKey.includes("augusta")) return "Home & Office";
  if (strategyKey.includes("retirement") || strategyKey.includes("health")) return "Benefits";
  if (strategyKey.includes("vehicle") || strategyKey.includes("travel") || strategyKey.includes("179") || strategyKey.includes("depreciation")) return "Documentation";
  return "Strategy";
}

export function isNewPage(page: WikiPage): boolean {
  const stamp = page.publishedAt || page.updatedAt;
  if (!stamp) {
    return false;
  }
  const age = Date.now() - new Date(stamp).getTime();
  return age < NEW_PAGE_WINDOW_MS;
}

export function planCommitment(item: PlanItem): string {
  if (item.done) {
    return "Completed. Keep supporting documents handy for review.";
  }
  if (item.strategyKey.includes("estimated")) {
    return "When you are ready, gather year-to-date income, withholding, and profit estimates.";
  }
  if (item.strategyKey.includes("kids")) {
    return "When you are ready, gather role, hours, pay rate, and payroll details.";
  }
  if (item.strategyKey.includes("augusta")) {
    return "When you are ready, gather agenda, attendees, notes, and comparable rates.";
  }
  return "When you are ready, gather facts and bring client-specific decisions to Shona/Jay.";
}
