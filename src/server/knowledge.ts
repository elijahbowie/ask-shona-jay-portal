import type { ChatAnswer, Citation, ClientProfile, DownloadAsset, TrainingRecommendation, WikiPage } from "../shared/types";
import { createId, nowIso, sha256 } from "./crypto";
import { all, first, mapAsset, mapWiki, recordAuditEvent, run, tenantId } from "./db";
import { allowedVisibilityTiers, queryVectorScores } from "./vector";
import { recommendationForStrategy } from "./personalization";

interface ChunkRow {
  id: string;
  tenant_id: string;
  wiki_page_id: string | null;
  source_id: string | null;
  vector_id: string;
  text: string;
  citation_json: string;
  published: number;
  visibility: string;
  visibility_tier: string;
  source_type: string;
  strategy_key: string;
  effective_year: string;
  requires_review: number;
  content_version: string;
}

interface RetrievedChunk {
  row: ChunkRow;
  citation: Citation;
  score: number;
}

const TAX_RISK_PATTERNS = [
  /\baudit\b/i,
  /\bpenalt(y|ies)\b/i,
  /\bfile\b.*\breturn\b/i,
  /\bamend(ed)?\b/i,
  /\birs\b/i,
  /\bcourt\b/i,
  /\blegal\b/i,
  /\bentity change\b/i,
  /\bentity setup\b/i,
  /\basset protection\b/i,
  /\bswitch.*s.?corp\b/i,
  /\blate s.?corp election\b/i,
  /\bform 2553\b/i,
  /\bs.?corp\b/i,
  /\bdistribution(s)?\b/i,
  /\breasonable compensation\b/i,
  /\bcontractor\b/i,
  /\bworker classification\b/i,
  /\bclassify\b/i,
  /\breal estate professional\b/i,
  /\bmaterial participation\b/i,
  /\bshort[- ]term rental\b/i,
  /\bcost segregation\b/i,
  /\bmedical reimbursement\b/i,
  /\bhealth reimbursement\b/i,
  /\bguarantee\b/i,
  /\bexact amount\b/i
];

const STRATEGY_QUERY_PATTERNS: Array<{ strategyKey: string; patterns: RegExp[] }> = [
  {
    strategyKey: "receipt-management",
    patterns: [/\breceipt(s)?\b/i, /\borganize\b.*\breceipt/i, /\bmonthly books?\b/i, /\bbookkeeping\b/i, /\bcategory\b.*\bexpense/i]
  },
  {
    strategyKey: "business-intention",
    patterns: [/\bbusiness intention\b/i, /\bintent\b.*\bdocument/i, /\bbusiness purpose\b/i, /\bdocument\b.*\bpurpose/i, /\bwrite.?off\b.*\bpurpose/i]
  },
  {
    strategyKey: "audit-defense-documentation",
    patterns: [/\baudit\b/i, /\birs\b.*\bproof\b/i, /\bdeposit(s)?\b.*\bincome\b/i, /\bbank statement(s)?\b/i, /\bdefend\b.*\bdeduction/i]
  },
  {
    strategyKey: "tax-intake-roadmap",
    patterns: [/\btax questionnaire\b/i, /\bintake\b/i, /\bupload\b.*\btax document/i, /\btax document(s)?\b/i, /\broadmap\b/i]
  },
  {
    strategyKey: "1099-business-flow",
    patterns: [/\b1099\b.*\b(llc|business)\b/i, /\bpaid\b.*\bpersonally\b/i, /\bincome\b.*\bbusiness account\b/i, /\bbroker(age)?\b.*\bpay/i]
  },
  {
    strategyKey: "augusta-payment-cadence",
    patterns: [/\baugusta\b.*\b(pay|payment|money|draw)\b/i, /\brent\b.*\bpay(ment)?\b/i, /\bmoney\b.*\bmove\b/i]
  },
  {
    strategyKey: "augusta-calendar-rate-planning",
    patterns: [/\baugusta\b.*\bcalendar\b/i, /\b14 days?\b.*\bcalendar\b/i, /\bfair rental\b.*\brate\b/i, /\bcomparable\b.*\brate\b/i]
  },
  {
    strategyKey: "home-office-monthly-cadence",
    patterns: [/\bhome office\b.*\bmonthly\b/i, /\bmonthly\b.*\breimburse/i, /\breimbursement\b.*\bcadence\b/i]
  },
  {
    strategyKey: "mixed-purpose-travel",
    patterns: [/\bmixed[- ]purpose\b.*\btravel\b/i, /\btravel\b.*\bfamily\b/i, /\bvacation\b.*\bbusiness\b/i, /\btrip memo\b/i, /\bbusiness retreat\b/i]
  },
  {
    strategyKey: "retirement-tax-buckets",
    patterns: [/\bretirement\b.*\bbucket/i, /\bwithdraw(al)?\b.*\bretirement\b/i, /\btax buckets?\b/i, /\brule of 55\b/i, /\binherited ira\b/i]
  },
  {
    strategyKey: "roth-conversion-review",
    patterns: [/\broth\b/i, /\bbackdoor\b.*\broth\b/i, /\bconversion\b/i, /\bfive[- ]year\b.*\bclock\b/i]
  },
  {
    strategyKey: "inheritance-basis-planning",
    patterns: [/\binherit(ance|ed)?\b/i, /\bbasis\b/i, /\bestate\b.*\bplanning\b/i, /\bownership\b.*\bchange\b/i]
  },
  {
    strategyKey: "health-insurance-before-medicare",
    patterns: [/\bhealth insurance\b/i, /\bmedicare\b/i, /\bmarketplace\b/i, /\bgroup insurance\b/i]
  },
  {
    strategyKey: "medical-expense-paths",
    patterns: [/\bmedical expense(s)?\b/i, /\bhsa\b/i, /\bitemized\b.*\bmedical\b/i, /\bover[- ]the[- ]counter\b/i]
  },
  {
    strategyKey: "ministerial-housing-allowance",
    patterns: [/\bministerial\b/i, /\bhousing allowance\b/i, /\bchurch\b.*\bhousing\b/i]
  },
  {
    strategyKey: "business-owner-tax-mindset",
    patterns: [/\btax mindset\b/i, /\bbusiness owner\b.*\btax(es)?\b/i, /\bemployee\b.*\bbusiness owner\b/i, /\bestimated\b.*\bself[- ]employment\b/i]
  },
  {
    strategyKey: "tax-plan-vault-roadmap",
    patterns: [/\bpersonalized tax plan\b/i, /\bvault\b/i, /\bwhich lesson\b/i, /\bwhere should i start\b/i]
  },
  {
    strategyKey: "s-corp-reasonable-compensation",
    patterns: [/\bs.?corp\b.*\bpayroll\b/i, /\breasonable compensation\b/i, /\bofficer compensation\b/i, /\bowner salary\b/i, /\bdistributions?\b.*\bpayroll\b/i]
  },
  {
    strategyKey: "estimated-tax-system",
    patterns: [/\bestimated tax(es)?\b/i, /\bquarterly\b.*\bpayment(s)?\b/i, /\btax reserve\b/i, /\b30[- ]day\b.*\btax\b/i]
  },
  {
    strategyKey: "accountable-plan-system",
    patterns: [/\baccountable plan\b/i, /\breimburse(ment|ments)?\b.*\bplan\b/i, /\breturn\b.*\bexcess\b/i, /\bsubstantiat(e|ion)\b.*\breimburse/i]
  },
  {
    strategyKey: "qbi-deduction-review",
    patterns: [/\bqbi\b/i, /\bqualified business income\b/i, /\b199a\b/i, /\bsstb\b/i]
  },
  {
    strategyKey: "worker-classification-review",
    patterns: [/\bworker classification\b/i, /\bcontractor\b.*\bemployee\b/i, /\b1099\b.*\bworker\b/i, /\bclassify\b.*\bworker\b/i]
  },
  {
    strategyKey: "business-loss-limits",
    patterns: [/\bbusiness loss(es)?\b/i, /\bat[- ]risk\b/i, /\bpassive loss(es)?\b/i, /\bnol\b/i, /\bnet operating loss\b/i, /\bsuspended loss(es)?\b/i]
  },
  {
    strategyKey: "schedule-c-to-entity",
    patterns: [/\bschedule c\b/i, /\bsole proprietor\b.*\bentity\b/i, /\bmove\b.*\bllc\b/i, /\btransition\b.*\bentity\b/i]
  },
  {
    strategyKey: "irs-account-notice-workflow",
    patterns: [/\birs\b.*\bnotice\b/i, /\btax transcript\b/i, /\baccount transcript\b/i, /\brefund\b.*\bmissing\b/i, /\bwhere'?s my refund\b/i]
  },
  {
    strategyKey: "basis-tracking-system",
    patterns: [/\bbasis\b/i, /\bbasis tracking\b/i, /\badjusted basis\b/i, /\binherited\b.*\bbasis\b/i, /\bk-1\b.*\bbasis\b/i]
  },
  {
    strategyKey: "hsa-medical-decision-tree",
    patterns: [/\bhsa\b/i, /\bhigh deductible\b/i, /\bmedical\b.*\bdecision tree\b/i, /\bmedical\b.*\bdeduct(ion)?\b/i]
  },
  {
    strategyKey: "social-security-retirement-tax-planning",
    patterns: [/\bsocial security\b/i, /\bretirement\b.*\btax\b/i, /\bmedicare\b.*\bretirement\b/i, /\bpension\b/i, /\bretirement income\b/i]
  },
  {
    strategyKey: "year-end-strategy-review",
    patterns: [/\byear[- ]end\b/i, /\bend of year\b.*\bstrategy\b/i, /\bdecember\b.*\btax\b/i, /\bcloseout\b.*\bstrategy\b/i]
  },
  {
    strategyKey: "hire-kids-implementation-kit",
    patterns: [/\bhir(e|ing)\b.*\b(kid|kids|child|children)\b.*\b(kit|timesheet|job description|payroll)\b/i, /\btimesheet\b.*\b(kid|child)/i]
  },
  {
    strategyKey: "augusta-rule-meeting-packet",
    patterns: [/\baugusta\b.*\b(packet|minutes|agenda|invoice)\b/i, /\b(packet|minutes|agenda|invoice)\b.*\baugusta\b/i, /\bhome rental\b.*\bmeeting\b/i]
  },
  {
    strategyKey: "vehicle-mileage-actual-expense-kit",
    patterns: [/\bmileage\b.*\b(actual|standard|kit|log)\b/i, /\b(track|tracking)\b.*\bmileage\b/i, /\bvehicle\b.*\bexpense\b.*\bkit\b/i]
  },
  {
    strategyKey: "business-travel-trip-memo-kit",
    patterns: [/\btrip memo\b/i, /\btravel\b.*\b(memo|kit|allocation)\b/i, /\bmixed[- ]purpose\b.*\btrip\b/i]
  },
  {
    strategyKey: "home-office-reimbursement-worksheet",
    patterns: [/\bhome office\b.*\bworksheet\b/i, /\bhome office\b.*\breimburse(ment)?\b/i]
  },
  {
    strategyKey: "real-estate-strategy-intake-packet",
    patterns: [/\breal estate\b.*\bintake\b/i, /\bcost seg\b.*\bpacket\b/i, /\bstr\b.*\bintake\b/i, /\brep\b.*\blog\b/i]
  },
  {
    strategyKey: "accountable-plan-monthly-kit",
    patterns: [/\baccountable plan\b.*\bkit\b/i, /\bmonthly\b.*\breimbursement\b.*\bkit\b/i]
  },
  {
    strategyKey: "worker-classification-intake-checklist",
    patterns: [/\bworker\b.*\bclassification\b.*\bchecklist\b/i, /\bchecklist\b.*\b(contractor|worker|classification)\b/i, /\bcontractor\b.*\b(intake|checklist|paying|payment)\b/i]
  },
  {
    strategyKey: "estimated-tax-30-day-kit",
    patterns: [/\bestimated tax\b.*\b30[- ]day\b/i, /\bquarterly\b.*\breview\b.*\bkit\b/i]
  },
  {
    strategyKey: "tax-vault-file-structure",
    patterns: [/\btax vault\b/i, /\bvault\b.*\bfile\b/i, /\borganize\b.*\btax document(s)?\b/i]
  },
  {
    strategyKey: "irs-notice-response-packet",
    patterns: [/\birs notice\b.*\bpacket\b/i, /\bnotice\b.*\bresponse\b/i]
  },
  {
    strategyKey: "year-end-closeout-kit",
    patterns: [/\byear[- ]end\b.*\bcloseout\b/i, /\bstrategy\b.*\bcloseout\b/i]
  },
  {
    strategyKey: "hire-kids",
    patterns: [/\bhir(e|ing)\b.*\b(kid|kids|child|children)\b/i, /\b(kid|kids|child|children)\b.*\bpayroll\b/i]
  },
  {
    strategyKey: "augusta-rule",
    patterns: [/\baugusta\b/i, /\b14[- ]day\b.*\brent/i, /\brent(al)?\b.*\bhome\b/i]
  },
  {
    strategyKey: "estimated-taxes",
    patterns: [/\bestimated tax/i, /\bquarterly\b.*\btax/i, /\btax(es)?\b.*\bdue\b/i]
  },
  {
    strategyKey: "s-corp-compensation",
    patterns: [/\bs.?corp\b/i, /\bdistribution(s)?\b/i, /\breasonable compensation\b/i]
  },
  {
    strategyKey: "worker-classification",
    patterns: [/\bcontractor\b/i, /\bworker classification\b/i, /\bclassify\b.*\bworker\b/i, /\bemployee vs contractor\b/i]
  },
  {
    strategyKey: "section-179-depreciation",
    patterns: [/\bsection 179\b/i, /\bdepreciation\b/i, /\bequipment\b.*\bdeduct/i]
  },
  {
    strategyKey: "qbi-deduction",
    patterns: [/\bqbi\b/i, /\bqualified business income\b/i]
  },
  {
    strategyKey: "accountable-plan",
    patterns: [/\baccountable plan\b/i, /\breimburse(ment|ments)?\b/i]
  },
  {
    strategyKey: "vehicle-mileage",
    patterns: [/\bmileage\b/i, /\bvehicle\b/i, /\bcar\b.*\bbusiness\b/i]
  },
  {
    strategyKey: "home-office",
    patterns: [/\bhome office\b/i, /\bbusiness use of home\b/i]
  },
  {
    strategyKey: "meals",
    patterns: [/\bmeal(s)?\b/i, /\bdeduct\b.*\b(meal|restaurant|food)\b/i, /\bbusiness\b.*\bmeal/i]
  },
  {
    strategyKey: "travel",
    patterns: [/\btravel\b/i, /\bbusiness trip\b/i, /\bdeduct\b.*\b(flight|hotel|airfare|lodging)\b/i]
  },
  {
    strategyKey: "medical-reimbursement",
    patterns: [/\bmedical reimbursement\b/i, /\bhealth reimbursement\b/i, /\bmedical\b.*\bwrite.?off/i, /\bhealth\b.*\bdeduct/i]
  },
  {
    strategyKey: "cost-segregation",
    patterns: [/\bcost segregation\b/i, /\bcost seg\b/i, /\baccelerat(e|ed|ing)\b.*\bdepreciation\b/i]
  },
  {
    strategyKey: "real-estate-professional",
    patterns: [/\breal estate professional\b/i, /\brep status\b/i, /\b750\b.*\bhours\b/i]
  },
  {
    strategyKey: "short-term-rental",
    patterns: [/\bshort[- ]term rental\b/i, /\bstr\b/i, /\bairbnb\b/i, /\bmaterial participation\b/i]
  },
  {
    strategyKey: "entity-protection",
    patterns: [/\bentity\b/i, /\basset protection\b/i, /\bllc\b.*\bprotect/i, /\bprotect\b.*\basset/i]
  },
  {
    strategyKey: "late-s-corp-election",
    patterns: [/\blate\b.*\bs.?corp\b/i, /\bform 2553\b/i, /\bs.?corp election\b/i]
  },
  {
    strategyKey: "llc-to-s-corp",
    patterns: [/\bconvert\b.*\bs.?corp\b/i, /\bllc\b.*\bs.?corp\b/i, /\bswitch\b.*\bs.?corp\b/i]
  },
  {
    strategyKey: "depreciation",
    patterns: [/\bdepreciation\b/i, /\bbonus depreciation\b/i, /\bplaced in service\b/i]
  }
];

const CLARIFY_PATTERNS = [
  /\bmy\b/i,
  /\bmine\b/i,
  /\bfor me\b/i,
  /\bhow much\b/i,
  /\bexactly\b/i
];

// Implementation-intent detection, shared by strategyMatchBoost and
// preferredStrategyKeys. Stateless (no `g` flag) so a single instance is safe.
const IMPLEMENTATION_QUERY_TERMS = /\b(kit|packet|checklist|worksheet|memo|intake|closeout|file structure|30[- ]day)\b/i;
const IMPLEMENTATION_PAGE_KEY = /\b(kit|packet|checklist|worksheet)\b/;

export async function answerQuestion(env: Env, client: ClientProfile, question: string): Promise<ChatAnswer> {
  const cleanQuestion = question.trim();
  const retrieved = await retrieveChunks(env, client, cleanQuestion);
  const risk = classifyRisk(cleanQuestion, retrieved);
  const citations = dedupeCitations(retrieved.map((item) => item.citation)).slice(0, 5);
  const confidence = computeConfidence(retrieved, risk);
  const recommendedTrainings = await buildTrainingRecommendations(env, client, retrieved);
  const sourceDates = Array.from(new Set(retrieved.map((item) => item.row.effective_year)));
  const nextSteps = buildNextSteps(cleanQuestion, retrieved, risk, recommendedTrainings);
  const escalationRequired = risk !== "general_education" || confidence < 0.46 || citations.length === 0;
  const state = citations.length === 0
    ? "cannot_answer_from_approved_sources"
    : escalationRequired
      ? "cpa_review_recommended"
      : "answered_with_citations";
  const escalationReason = escalationRequired ? escalationReasonFor(risk, confidence, citations.length) : null;
  const generated = await generateGroundedAnswer(env, cleanQuestion, retrieved, risk, escalationRequired);
  const answer = generated?.answer ?? composeAnswer(cleanQuestion, retrieved, risk, escalationRequired);
  const modelId = generated?.modelId ?? "source-grounded-local-extractor";
  const conversationId = createId("conv");

  await run(
    env,
    `INSERT INTO conversations (
      id, tenant_id, client_id, question, answer, answer_state, confidence, citations_json,
      recommended_trainings_json, next_steps_json, escalation_required, escalation_reason,
      model_id, prompt_version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    conversationId,
    tenantId(),
    client.id,
    cleanQuestion,
    answer,
    state,
    confidence,
    JSON.stringify(citations),
    JSON.stringify(recommendedTrainings),
    JSON.stringify(nextSteps),
    escalationRequired ? 1 : 0,
    escalationReason,
    modelId,
    "ask-shona-jay-v1",
    nowIso()
  );

  return {
    conversationId,
    answer,
    state,
    citations,
    recommendedTrainings,
    nextSteps,
    confidence,
    escalationRequired,
    escalationReason,
    sourceDates,
    modelId,
    promptVersion: "ask-shona-jay-v1"
  };
}

export async function retrieveChunks(env: Env, client: ClientProfile, question: string): Promise<RetrievedChunk[]> {
  const allowedTiers = allowedVisibilityTiers(client.tier);
  const tierPlaceholders = allowedTiers.map(() => "?").join(", ");
  const vectorScores = await queryVectorScores(env, client, question);
  const rows = await all<ChunkRow>(
    env,
    `SELECT * FROM knowledge_chunks
     WHERE tenant_id = ?
       AND published = 1
       AND visibility IN ('client', 'public')
       AND visibility_tier IN (${tierPlaceholders})
     ORDER BY created_at DESC`,
    tenantId(),
    ...allowedTiers
  );
  const questionTerms = tokenize(question);
  const explicitStrategyKeys = matchingStrategyKeys(question);
  const preferredKeys = preferredStrategyKeys(question);
  const clientTerms = new Set([...client.tags.map(normalizeTerm), normalizeTerm(client.entityType), normalizeTerm(client.lifecycleStage)]);

  return rows
    .map((row) => {
      const textTerms = tokenize(`${row.text} ${row.strategy_key} ${row.source_type}`);
      const termOverlap = questionTerms.filter((term) => textTerms.includes(term)).length;
      const strategyBoost = clientTerms.has(normalizeTerm(row.strategy_key)) ? 1.2 : 0;
      const childrenBoost = client.hasChildren && row.strategy_key.includes("hire-kids") ? 1.3 : 0;
      const exactPhraseBoost = row.text.toLowerCase().includes(question.toLowerCase().slice(0, 24)) ? 2 : 0;
      const strategyIntentBoost = strategyMatchBoost(row.strategy_key, question);
      const vectorBoost = (vectorScores.get(row.id) ?? 0) * 4;
      const score = termOverlap + strategyBoost + childrenBoost + exactPhraseBoost + strategyIntentBoost + vectorBoost;
      const relevantToQuestion = termOverlap > 0 || exactPhraseBoost > 0 || strategyIntentBoost > 0 || vectorBoost > 0;
      return {
        row,
        citation: JSON.parse(row.citation_json) as Citation,
        score,
        relevantToQuestion
      };
    })
    .filter((item) => item.score > 0.2 && item.relevantToQuestion)
    .filter((item) => explicitStrategyKeys.size === 0 || explicitStrategyKeys.has(item.row.strategy_key))
    .filter((item) => preferredKeys.size === 0 || preferredKeys.has(item.row.strategy_key))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function strategyMatchesQuestion(strategyKey: string, question: string): boolean {
  return STRATEGY_QUERY_PATTERNS.some((item) => item.strategyKey === strategyKey && item.patterns.some((pattern) => pattern.test(question)));
}

function strategyMatchBoost(strategyKey: string, question: string): number {
  if (!strategyMatchesQuestion(strategyKey, question)) {
    return 0;
  }
  const isImplementationPage = IMPLEMENTATION_PAGE_KEY.test(strategyKey);
  return IMPLEMENTATION_QUERY_TERMS.test(question) && isImplementationPage ? 10 : 6;
}

function matchingStrategyKeys(question: string): Set<string> {
  return new Set(
    STRATEGY_QUERY_PATTERNS
      .filter((item) => item.patterns.some((pattern) => pattern.test(question)))
      .map((item) => item.strategyKey)
  );
}

function preferredStrategyKeys(question: string): Set<string> {
  if (!IMPLEMENTATION_QUERY_TERMS.test(question)) {
    return new Set();
  }
  return new Set(
    Array.from(matchingStrategyKeys(question))
      .filter((strategyKey) => IMPLEMENTATION_PAGE_KEY.test(strategyKey))
  );
}

function tokenize(input: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "you",
    "your",
    "are",
    "can",
    "what",
    "how",
    "when",
    "should",
    "about",
    "from",
    "before",
    "after",
    "need",
    "understand"
  ]);
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(normalizeTerm)
    .filter((term) => term.length > 2 && !stop.has(term));
}

function normalizeTerm(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function classifyRisk(question: string, chunks: RetrievedChunk[]): "general_education" | "needs_context" | "high_risk" | "unsupported" {
  if (chunks.length === 0) {
    return "unsupported";
  }
  if (TAX_RISK_PATTERNS.some((pattern) => pattern.test(question))) {
    return "high_risk";
  }
  if (CLARIFY_PATTERNS.some((pattern) => pattern.test(question)) && /tax|payroll|deduct|filing|deadline|kids|augusta|estimate/i.test(question)) {
    return "needs_context";
  }
  return "general_education";
}

function computeConfidence(chunks: RetrievedChunk[], risk: string): number {
  if (chunks.length === 0) {
    return 0.12;
  }
  const score = Math.min(0.95, 0.35 + chunks.slice(0, 3).reduce((sum, item) => sum + item.score, 0) / 12);
  if (risk === "high_risk") {
    return Math.min(score, 0.52);
  }
  if (risk === "needs_context") {
    return Math.min(score, 0.68);
  }
  return Number(score.toFixed(2));
}

function composeAnswer(question: string, chunks: RetrievedChunk[], risk: string, escalationRequired: boolean): string {
  if (chunks.length === 0) {
    return "I could not find enough approved Beyond Freedom material to answer that responsibly. The best next step is to send this to the team so they can answer it directly and decide whether a new training or wiki page is needed.";
  }
  const strongest = chunks[0];
  const supporting = chunks.slice(1, 3);
  const intro = risk === "general_education"
    ? "Based on the approved Beyond Freedom materials, here is the practical guidance:"
    : "Based on the approved Beyond Freedom materials, this is a good starting point, but the team should review before you act:";
  const sentences = extractUsefulSentences(strongest.row.text, question).slice(0, 3);
  const support = supporting
    .flatMap((item) => extractUsefulSentences(item.row.text, question).slice(0, 1))
    .slice(0, 2);
  const body = [...sentences, ...support].join(" ");
  const close = escalationRequired
    ? "Because your question may depend on your exact facts, use the escalation option so your advisor can confirm the right implementation path."
    : "Use the cited training before taking action, and escalate if your facts differ from the examples in the material.";
  return `${intro}\n\n${body}\n\n${close}`;
}

async function generateGroundedAnswer(
  env: Env,
  question: string,
  chunks: RetrievedChunk[],
  risk: string,
  escalationRequired: boolean
): Promise<{ answer: string; modelId: string } | null> {
  if (chunks.length === 0) {
    return null;
  }
  const sourceContext = chunks
    .slice(0, 5)
    .map((item, index) => {
      const source = item.citation.sourceTitle;
      const quote = item.row.text.slice(0, 1200);
      return `[S${index + 1}] ${source}\n${quote}`;
    })
    .join("\n\n");
  const system = [
    "You answer as the Ask Advisor client education assistant.",
    "Use only the approved source excerpts provided.",
    "Speak directly to the client using you and your; do not refer to them as the client.",
    "Do not provide personalized CPA, legal, filing, penalty, audit, or guarantee advice.",
    "Do not refuse when the source excerpts contain a general setup workflow; give the source-grounded checklist and state that the team must confirm fact-specific decisions.",
    "If the question depends on exact client facts, say the team should review it before action.",
    "Keep the response concise and practical. Do not invent citations; the app displays citations separately."
  ].join(" ");
  const reviewNote = escalationRequired
    ? "This answer must explicitly recommend team review before the client acts."
    : "This answer may be educational guidance, with a reminder to compare the source examples to the client's facts.";
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Client question:\n${question}\n\nRisk classification: ${risk}. ${reviewNote}\n\nApproved sources:\n${sourceContext}`
    }
  ];

  const gatewayAnswer = await generateViaAiGateway(env, messages);
  if (gatewayAnswer && !isUnhelpfulRefusal(gatewayAnswer.answer)) {
    return gatewayAnswer;
  }

  if (!env.AI) {
    return null;
  }

  try {
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
      messages,
      temperature: 0.2,
      max_tokens: 420
    });
    const response = (result as { response?: string }).response?.trim();
    if (!response || response.length < 40 || isUnhelpfulRefusal(response)) {
      return null;
    }
    return { answer: response, modelId: "workers-ai/llama-3.1-8b-source-grounded" };
  } catch (error) {
    // Unexpected AI exception (not a normal decline, which returns null above).
    // Fall through to the deterministic extractor, but leave a trail so a
    // persistent AI-tier outage isn't invisible. Signal write is best-effort.
    await recordAuditEvent(env, {
      actor: "system",
      action: "ai.fallback",
      targetType: "system",
      targetId: "workers_ai",
      metadata: { model: "@cf/meta/llama-3.1-8b-instruct-fp8", error: error instanceof Error ? error.message : String(error) }
    }).catch(() => {});
    return null;
  }
}

function isUnhelpfulRefusal(answer: string): boolean {
  const normalized = answer.toLowerCase();
  return normalized.includes("i can't provide") || normalized.includes("i cannot provide") || normalized.includes("i'm unable to provide");
}

async function generateViaAiGateway(
  env: Env,
  messages: Array<{ role: string; content: string }>
): Promise<{ answer: string; modelId: string } | null> {
  if (!env.AI_GATEWAY_URL || !env.AI_GATEWAY_TOKEN) {
    return null;
  }
  const model = env.AI_GATEWAY_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8";
  try {
    const response = await fetch(env.AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_GATEWAY_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 420
      })
    });
    if (!response.ok) {
      return null;
    }
    const json = await response.json<any>();
    const answer = json.choices?.[0]?.message?.content?.trim() || json.response?.trim();
    if (!answer || answer.length < 40) {
      return null;
    }
    return { answer, modelId: `ai-gateway/${model}` };
  } catch (error) {
    await recordAuditEvent(env, {
      actor: "system",
      action: "ai.fallback",
      targetType: "system",
      targetId: "ai_gateway",
      metadata: { model, error: error instanceof Error ? error.message : String(error) }
    }).catch(() => {});
    return null;
  }
}

function extractUsefulSentences(text: string, question: string): string[] {
  const terms = new Set(tokenize(question));
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({
      sentence,
      score: tokenize(sentence).filter((term) => terms.has(term)).length
    }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.sentence);
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const output: Citation[] = [];
  for (const citation of citations) {
    const key = `${citation.sourceId}:${citation.wikiPageId}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(citation);
    }
  }
  return output;
}

async function buildTrainingRecommendations(env: Env, client: ClientProfile, chunks: RetrievedChunk[]): Promise<TrainingRecommendation[]> {
  const allowedTiers = allowedVisibilityTiers(client.tier);
  const tierPlaceholders = allowedTiers.map(() => "?").join(", ");
  // Recommendations are best-effort: a query failure degrades to "no recommendations"
  // rather than failing the answer. But signal it (no logger in this app) so a real
  // outage or a column-rename migration doesn't silently empty Learn/Plan for everyone.
  const onQueryFailure = (source: string) => async (error: unknown): Promise<any[]> => {
    await recordAuditEvent(env, {
      actor: client.id,
      action: "recommendations.query_failed",
      targetType: "system",
      targetId: source,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    }).catch(() => {});
    return [];
  };
  const [pageRows, assetRows] = await Promise.all([
    all<any>(
      env,
      `SELECT * FROM wiki_pages
       WHERE tenant_id = ? AND status = 'published'
         AND visibility IN ('client', 'public')
         AND visibility_tier IN (${tierPlaceholders})`,
      tenantId(),
      ...allowedTiers
    ).catch(onQueryFailure("wiki_pages")),
    all<any>(
      env,
      `SELECT * FROM download_assets
       WHERE tenant_id = ? AND status = 'published'
         AND visibility_tier IN (${tierPlaceholders})`,
      tenantId(),
      ...allowedTiers
    ).catch(onQueryFailure("download_assets"))
  ]);
  const pages = pageRows.map((row) => mapWiki(row)) as WikiPage[];
  const assets = assetRows.map((row) => mapAsset(row)) as DownloadAsset[];
  const recommendations = new Map<string, TrainingRecommendation>();
  for (const item of chunks) {
    const canonical = recommendationForStrategy(item.row.strategy_key, pages, assets);
    const fallback = {
      title: item.citation.sourceTitle,
      strategyKey: item.row.strategy_key,
      reason: `This source directly supports the ${item.row.strategy_key.replace(/-/g, " ")} guidance.`,
      url: item.citation.clientVisibleUrl
    };
    const recommendation = canonical || fallback;
    recommendations.set(recommendation.url, recommendation);
  }
  return Array.from(recommendations.values()).slice(0, 3);
}

// Topic-specific next-step prompts, matched in order against the question. The
// patterns are stateless (no `g` flag), so the shared table is safe to reuse.
const NEXT_STEP_RULES: Array<{ pattern: RegExp; step: string }> = [
  { pattern: /kid|child|children/i, step: "Prepare the job description, time records, pay rate support, and payroll path before hiring a child." },
  { pattern: /augusta|home|rent/i, step: "Prepare the business purpose, agenda, minutes, invoice, payment record, and comparable rental-rate support." },
  { pattern: /estimate|quarter|deadline/i, step: "Review year-to-date profit and book a review before the payment deadline if income changed." },
  { pattern: /contractor|worker|classification|1099/i, step: "Complete the worker classification checklist before paying or onboarding the worker." },
  { pattern: /mileage|vehicle|car/i, step: "Start a contemporaneous mileage log with date, destination, business purpose, and miles." },
  { pattern: /year[- ]end|closeout|december/i, step: "Use the year-end closeout checklist to gather books, payroll, deductions, entity updates, and open advisor questions." },
  { pattern: /meal/i, step: "Keep the receipt, attendees, business purpose, and notes showing how the meal relates to the business." },
  { pattern: /travel|trip|flight|hotel|lodging/i, step: "Save the itinerary, receipts, calendar purpose, and notes separating business and personal time." },
  { pattern: /s.?corp|2553|election|distribution/i, step: "Ask the team to review entity status, payroll, reasonable compensation, and election timing before acting." },
  { pattern: /real estate professional|short[- ]term rental|material participation|cost seg/i, step: "Gather hours, activity logs, property details, and depreciation records before requesting strategy review." },
  { pattern: /medical|health reimbursement/i, step: "Confirm entity type, plan setup, payment path, and reimbursement documentation with the team first." }
];

function buildNextSteps(
  question: string,
  chunks: RetrievedChunk[],
  risk: string,
  recommendations: TrainingRecommendation[]
): string[] {
  if (chunks.length === 0) {
    return [
      "Ask the team to answer this directly.",
      "Request that the answer be added to the approved knowledge base.",
      "Avoid relying on general tax information until the team reviews your facts."
    ];
  }
  const primary = recommendations[0];
  const base = primary
    ? [
        `Open ${primary.title}.`,
        primary.assetTitle ? `Download ${primary.assetTitle}.` : "Use the checklist or records list in the lesson before gathering documents.",
        "Compare the lesson examples to your own situation before implementing anything."
      ]
    : [
        "Open the cited training or wiki page.",
        "Compare the example facts to your own situation.",
        "Keep documentation before implementing the strategy."
      ];
  for (const rule of NEXT_STEP_RULES) {
    if (rule.pattern.test(question)) {
      base.push(rule.step);
    }
  }
  if (risk !== "general_education") {
    base.push("Escalate this question for CPA review before acting.");
  }
  return Array.from(new Set(base)).slice(0, 5);
}

function escalationReasonFor(risk: string, confidence: number, citationCount: number): string {
  if (citationCount === 0) {
    return "No approved source supports a client-facing answer.";
  }
  if (risk === "high_risk") {
    return "The question appears to involve tax controversy, filing position, penalties, or other high-risk facts.";
  }
  if (risk === "needs_context") {
    return "The question depends on client-specific facts that should be reviewed by the team.";
  }
  return `Retrieval confidence was below the launch threshold (${confidence.toFixed(2)}).`;
}

export async function createEscalation(
  env: Env,
  input: { clientId: string; conversationId?: string; question: string; reason: string }
): Promise<string> {
  const id = createId("esc");
  const now = nowIso();
  const redacted = redactSensitive(`Client question: ${input.question}. Reason: ${input.reason}`);
  await run(
    env,
    `INSERT INTO escalations (
      id, tenant_id, client_id, conversation_id, status, reason, question, redacted_summary,
      ghl_task_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId(),
    input.clientId,
    input.conversationId ?? null,
    "open",
    input.reason,
    input.question,
    redacted,
    null,
    now,
    now
  );
  await recordAuditEvent(env, {
    actor: input.clientId,
    action: "escalation.create",
    targetType: "escalation",
    targetId: id,
    metadata: { conversationId: input.conversationId ?? null, reason: input.reason },
    at: now
  });
  return id;
}

export function redactSensitive(input: string): string {
  return input
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-ssn]")
    .replace(/\b\d{2}-\d{7}\b/g, "[redacted-ein]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]");
}

export async function sourceHashForContent(content: string): Promise<string> {
  return sha256(content);
}

export async function getTrainingBySlug(env: Env, slug: string): Promise<{ page: any; markdown: string } | null> {
  const page = await first<any>(
    env,
    "SELECT * FROM wiki_pages WHERE tenant_id = ? AND slug = ? AND status = 'published' LIMIT 1",
    tenantId(),
    slug
  );
  if (!page) {
    return null;
  }
  const object = await env.CONTENT_BUCKET.get(page.compiled_r2_key);
  const markdown = object ? await object.text() : page.summary;
  return { page, markdown };
}
