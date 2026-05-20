import type { ChatAnswer, Citation, ClientProfile, TrainingRecommendation } from "../shared/types";
import { createId, nowIso, sha256 } from "./crypto";
import { all, first, run, tenantId } from "./db";
import { allowedVisibilityTiers, queryVectorScores } from "./vector";

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
  /\bswitch.*s.?corp\b/i,
  /\bs.?corp\b/i,
  /\bdistribution(s)?\b/i,
  /\breasonable compensation\b/i,
  /\bcontractor\b/i,
  /\bworker classification\b/i,
  /\bclassify\b/i,
  /\bguarantee\b/i,
  /\bexact amount\b/i
];

const STRATEGY_QUERY_PATTERNS: Array<{ strategyKey: string; patterns: RegExp[] }> = [
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
  }
];

const CLARIFY_PATTERNS = [
  /\bmy\b/i,
  /\bmine\b/i,
  /\bfor me\b/i,
  /\bhow much\b/i,
  /\bexactly\b/i
];

export async function answerQuestion(env: Env, client: ClientProfile, question: string): Promise<ChatAnswer> {
  const cleanQuestion = question.trim();
  const retrieved = await retrieveChunks(env, client, cleanQuestion);
  const risk = classifyRisk(cleanQuestion, retrieved);
  const citations = dedupeCitations(retrieved.map((item) => item.citation)).slice(0, 5);
  const confidence = computeConfidence(retrieved, risk);
  const recommendedTrainings = buildTrainingRecommendations(retrieved);
  const sourceDates = Array.from(new Set(retrieved.map((item) => item.row.effective_year)));
  const nextSteps = buildNextSteps(cleanQuestion, retrieved, risk);
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
  const clientTerms = new Set([...client.tags.map(normalizeTerm), normalizeTerm(client.entityType), normalizeTerm(client.lifecycleStage)]);

  return rows
    .map((row) => {
      const textTerms = tokenize(`${row.text} ${row.strategy_key} ${row.source_type}`);
      const termOverlap = questionTerms.filter((term) => textTerms.includes(term)).length;
      const strategyBoost = clientTerms.has(normalizeTerm(row.strategy_key)) ? 1.2 : 0;
      const childrenBoost = client.hasChildren && row.strategy_key.includes("hire-kids") ? 1.3 : 0;
      const exactPhraseBoost = row.text.toLowerCase().includes(question.toLowerCase().slice(0, 24)) ? 2 : 0;
      const strategyIntentBoost = strategyMatchesQuestion(row.strategy_key, question) ? 6 : 0;
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
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function strategyMatchesQuestion(strategyKey: string, question: string): boolean {
  return STRATEGY_QUERY_PATTERNS.some((item) => item.strategyKey === strategyKey && item.patterns.some((pattern) => pattern.test(question)));
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
    ? "Because your question may depend on your exact facts, use the escalation option so Shona/Jay's team can confirm the right implementation path."
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
    "You answer as the Ask Shona/Jay client education assistant.",
    "Use only the approved source excerpts provided.",
    "Do not provide personalized CPA, legal, filing, penalty, audit, or guarantee advice.",
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
  if (gatewayAnswer) {
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
    if (!response || response.length < 40) {
      return null;
    }
    return { answer: response, modelId: "workers-ai/llama-3.1-8b-source-grounded" };
  } catch {
    return null;
  }
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
  } catch {
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

function buildTrainingRecommendations(chunks: RetrievedChunk[]): TrainingRecommendation[] {
  const recommendations = new Map<string, TrainingRecommendation>();
  for (const item of chunks) {
    const title = item.citation.sourceTitle;
    recommendations.set(item.row.strategy_key, {
      title,
      strategyKey: item.row.strategy_key,
      reason: `This source directly supports the ${item.row.strategy_key.replace(/-/g, " ")} guidance.`,
      url: item.citation.clientVisibleUrl
    });
  }
  return Array.from(recommendations.values()).slice(0, 3);
}

function buildNextSteps(question: string, chunks: RetrievedChunk[], risk: string): string[] {
  if (chunks.length === 0) {
    return [
      "Ask the team to answer this directly.",
      "Request that the answer be added to the approved knowledge base.",
      "Avoid relying on general tax information until the team reviews your facts."
    ];
  }
  const base = [
    "Open the cited training or wiki page.",
    "Compare the example facts to your own situation.",
    "Keep documentation before implementing the strategy."
  ];
  if (/kid|child|children/i.test(question)) {
    base.push("Confirm duties, pay reasonableness, hours, and payroll handling before hiring a child.");
  }
  if (/augusta|home|rent/i.test(question)) {
    base.push("Document business purpose, agenda, notes, and comparable rental rates.");
  }
  if (/estimate|quarter|deadline/i.test(question)) {
    base.push("Review year-to-date profit and book a review before the payment deadline if income changed.");
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
  await run(
    env,
    "INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("audit"),
    tenantId(),
    input.clientId,
    "escalation.create",
    "escalation",
    id,
    JSON.stringify({ conversationId: input.conversationId ?? null, reason: input.reason }),
    now
  );
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
