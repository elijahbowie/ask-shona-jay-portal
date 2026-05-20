import type {
  ClientProfile,
  Escalation,
  HealthFinding,
  SourceDocument,
  SourceType,
  WikiPage
} from "../shared/types";
import { createId, nowIso, sha256 } from "./crypto";

const TENANT_ID = "tenant_beyond_freedom";

export function tenantId(): string {
  return TENANT_ID;
}

type D1Value = string | number | null;

export async function run(env: Env, sql: string, ...binds: D1Value[]): Promise<D1Result> {
  return env.DB.prepare(sql)
    .bind(...binds)
    .run();
}

export async function first<T>(env: Env, sql: string, ...binds: D1Value[]): Promise<T | null> {
  const row = await env.DB.prepare(sql)
    .bind(...binds)
    .first<T>();
  return row ?? null;
}

export async function all<T>(env: Env, sql: string, ...binds: D1Value[]): Promise<T[]> {
  const result = await env.DB.prepare(sql)
    .bind(...binds)
    .all<T>();
  return result.results ?? [];
}

export async function seedIfNeeded(env: Env): Promise<void> {
  const existing = await first<{ id: string }>(env, "SELECT id FROM tenants WHERE id = ?", TENANT_ID);
  if (existing) {
    return;
  }

  const now = nowIso();
  await run(env, "INSERT INTO tenants (id, name, domain, created_at) VALUES (?, ?, ?, ?)", TENANT_ID, "Beyond Freedom Financial", "ask.beyondfreedomfinancial.com", now);

  if (env.ENVIRONMENT === "production") {
    return;
  }

  await run(
    env,
    `INSERT INTO client_profiles (
      id, tenant_id, email, name, ghl_contact_id, tier, entity_type, lifecycle_stage,
      tags_json, has_children, access_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "client_demo_shona",
    TENANT_ID,
    "client@example.com",
    "Demo Client",
    "ghl_demo_contact",
    "mid",
    "s_corp",
    "onboarding",
    JSON.stringify(["hire-kids", "augusta-rule", "estimated-taxes"]),
    1,
    "active",
    now,
    now
  );

  await createSeedKnowledge(env, {
    title: "Hiring Your Kids Strategy Training",
    sourceType: "training",
    strategyKey: "hire-kids",
    content: `Hiring your children can be a valuable family tax strategy when the child performs real work, the pay is reasonable, and the business keeps clean documentation. The training explains that parents should define age-appropriate duties, track hours, pay through a compliant payroll process when required, and keep proof of completed work. Clients should ask the team before implementing if they are unsure about payroll setup, entity type, or state requirements.`
  });

  await createSeedKnowledge(env, {
    title: "Augusta Rule Weekly Call Transcript",
    sourceType: "transcript",
    strategyKey: "augusta-rule",
    content: `The Augusta Rule allows a homeowner to rent their home to their business for limited business use when the rental is documented, reasonable, and tied to a legitimate business meeting. The team repeatedly tells clients to create an agenda, capture meeting notes, document comparable local rates, and avoid treating it like a casual reimbursement. Clients should escalate if they are unsure whether their event qualifies.`
  });

  await createSeedKnowledge(env, {
    title: "Estimated Tax Reminder Email",
    sourceType: "email",
    strategyKey: "estimated-taxes",
    content: `Estimated tax planning should happen before the deadline, not after. Clients should review year-to-date income, withholding, expected profit, entity distributions, and any major changes at least 30 days before a quarterly payment date. If income changed materially, clients should book a review with the team before making assumptions.`
  });
}

async function createSeedKnowledge(
  env: Env,
  input: { title: string; sourceType: SourceType; strategyKey: string; content: string }
): Promise<void> {
  const now = nowIso();
  const sourceId = createId("src");
  const wikiId = createId("wiki");
  const contentHash = await sha256(input.content);
  const sourceKey = `raw/${TENANT_ID}/${sourceId}/${contentHash}.md`;
  const compiledKey = `compiled/pages/${TENANT_ID}/${wikiId}/${contentHash}.md`;
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const summary = input.content.slice(0, 220);
  const markdown = `# ${input.title}\n\n${input.content}\n\n## Client Checklist\n\n- Review the strategy overview.\n- Confirm the facts match your situation.\n- Ask the Beyond Freedom team when implementation details affect payroll, entity structure, deadlines, or filings.\n`;

  await env.CONTENT_BUCKET.put(sourceKey, input.content);
  await env.CONTENT_BUCKET.put(compiledKey, markdown);

  await run(
    env,
    `INSERT INTO source_documents (
      id, tenant_id, title, source_type, r2_key, normalized_r2_key, content_hash, version_hash,
      status, visibility, visibility_tier, strategy_key, effective_year, audience, review_owner,
      error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sourceId,
    TENANT_ID,
    input.title,
    input.sourceType,
    sourceKey,
    sourceKey,
    contentHash,
    contentHash,
    "published",
    "client",
    "mid",
    input.strategyKey,
    "2026",
    "clients",
    "Shona Bell",
    null,
    now,
    now
  );

  await run(
    env,
    `INSERT INTO wiki_pages (
      id, tenant_id, source_id, slug, title, summary, compiled_r2_key, status, visibility,
      visibility_tier, strategy_key, effective_year, approved_by, approved_at, published_at,
      version_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    wikiId,
    TENANT_ID,
    sourceId,
    slug,
    input.title,
    summary,
    compiledKey,
    "published",
    "client",
    "mid",
    input.strategyKey,
    "2026",
    "system",
    now,
    now,
    contentHash,
    now,
    now
  );

  const chunkId = createId("chunk");
  const citation = {
    sourceId,
    sourceTitle: input.title,
    sourceType: input.sourceType,
    wikiPageId: wikiId,
    quoteSpan: input.content.slice(0, 180),
    timestamp: input.sourceType === "transcript" ? "00:00" : null,
    clientVisibleUrl: `/trainings/${slug}`,
    confidence: 0.92
  };

  await run(
    env,
    `INSERT INTO knowledge_chunks (
      id, tenant_id, wiki_page_id, source_id, vector_id, corpus, chunk_index, text, citation_json,
      published, visibility, visibility_tier, source_type, strategy_key, effective_year,
      requires_review, content_version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    chunkId,
    TENANT_ID,
    wikiId,
    sourceId,
    `vector_${chunkId}`,
    "wiki_chunks",
    0,
    input.content,
    JSON.stringify(citation),
    1,
    "client",
    "mid",
    input.sourceType,
    input.strategyKey,
    "2026",
    0,
    contentHash,
    now
  );
}

export function mapClient(row: any): ClientProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    name: row.name,
    tier: row.tier,
    entityType: row.entity_type,
    lifecycleStage: row.lifecycle_stage,
    tags: JSON.parse(row.tags_json || "[]"),
    hasChildren: Boolean(row.has_children),
    accessStatus: row.access_status
  };
}

export function mapSource(row: any): SourceDocument {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    status: row.status,
    visibility: row.visibility,
    visibilityTier: row.visibility_tier,
    strategyKey: row.strategy_key,
    effectiveYear: row.effective_year,
    audience: row.audience,
    reviewOwner: row.review_owner,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapWiki(row: any, markdown?: string): WikiPage {
  return {
    id: row.id,
    sourceId: row.source_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    markdown,
    status: row.status,
    visibility: row.visibility,
    visibilityTier: row.visibility_tier,
    strategyKey: row.strategy_key,
    effectiveYear: row.effective_year,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

export function mapEscalation(row: any): Escalation {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    question: row.question,
    redactedSummary: row.redacted_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapHealth(row: any): HealthFinding {
  return {
    id: row.id,
    severity: row.severity,
    category: row.category,
    title: row.title,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at
  };
}
