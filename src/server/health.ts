import { createId, nowIso } from "./crypto";
import { all, run, tenantId } from "./db";

export async function runHealthChecks(env: Env): Promise<number> {
  const now = nowIso();
  let created = 0;
  const draftPages = await all<any>(
    env,
    "SELECT id, title FROM wiki_pages WHERE tenant_id = ? AND status IN ('draft', 'approved')",
    tenantId()
  );
  for (const page of draftPages) {
    if (await createFinding(env, "medium", "unpublished_draft", `Draft awaiting publication: ${page.title}`, "This page has been compiled but is not yet visible to clients.", page.id)) {
      created += 1;
    }
  }

  const orphanSources = await all<any>(
    env,
    `SELECT s.id, s.title FROM source_documents s
     LEFT JOIN wiki_pages w ON w.source_id = s.id
     WHERE s.tenant_id = ? AND w.id IS NULL`,
    tenantId()
  );
  for (const source of orphanSources) {
    if (await createFinding(env, "high", "orphan_source", `Source missing wiki page: ${source.title}`, "This source has not been compiled into an approved wiki page.", source.id)) {
      created += 1;
    }
  }

  const noAnswerQuestions = await all<any>(
    env,
    `SELECT question, COUNT(*) AS total FROM conversations
     WHERE tenant_id = ? AND answer_state = 'cannot_answer_from_approved_sources'
     GROUP BY question HAVING total >= 1`,
    tenantId()
  );
  for (const item of noAnswerQuestions) {
    if (await createFinding(env, "medium", "knowledge_gap", `Knowledge gap: ${item.question}`, "Clients asked a question that could not be answered from approved sources.", item.question)) {
      created += 1;
    }
  }

  const lowConfidence = await all<any>(
    env,
    `SELECT question, COUNT(*) AS total, MAX(created_at) AS last_seen
     FROM conversations
     WHERE tenant_id = ? AND confidence < 0.46
     GROUP BY question HAVING total >= 1`,
    tenantId()
  );
  for (const item of lowConfidence) {
    if (await createFinding(env, "medium", "low_confidence_answer", `Low confidence answer: ${item.question}`, `One or more answers were below confidence threshold. Count: ${item.total}.`, item.question)) {
      created += 1;
    }
  }

  const repeatedQuestions = await all<any>(
    env,
    `SELECT LOWER(TRIM(question)) AS question, COUNT(*) AS total
     FROM conversations
     WHERE tenant_id = ?
     GROUP BY LOWER(TRIM(question)) HAVING total >= 2`,
    tenantId()
  );
  for (const item of repeatedQuestions) {
    if (await createFinding(env, "medium", "repeated_question", `Repeated client question: ${item.question}`, `Clients asked this question repeatedly. Count: ${item.total}.`, item.question)) {
      created += 1;
    }
  }

  const missingAssets = await all<any>(
    env,
    `SELECT w.id, w.title, w.slug, w.strategy_key
     FROM wiki_pages w
     LEFT JOIN download_assets a ON a.tenant_id = w.tenant_id
       AND a.linked_slug = w.slug
       AND a.status = 'published'
     WHERE w.tenant_id = ? AND w.status = 'published'
     GROUP BY w.id
     HAVING (
       w.strategy_key LIKE '%kit%' OR
       w.strategy_key LIKE '%packet%' OR
       w.strategy_key LIKE '%worksheet%' OR
       w.strategy_key LIKE '%checklist%'
     ) AND COUNT(a.id) = 0`,
    tenantId()
  );
  for (const page of missingAssets) {
    if (await createFinding(env, "medium", "missing_download_asset", `Missing download asset: ${page.title}`, "Implementation pages should have a downloadable worksheet, checklist, or packet attached.", page.slug)) {
      created += 1;
    }
  }

  await run(
    env,
    "INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("audit"),
    tenantId(),
    "system",
    "health.run",
    "health",
    "health_run",
    JSON.stringify({ created }),
    now
  );
  return created;
}

async function createFinding(env: Env, severity: string, category: string, title: string, detail: string, target: string): Promise<boolean> {
  const duplicate = await env.DB.prepare(
    "SELECT id FROM health_findings WHERE tenant_id = ? AND category = ? AND title = ? AND status = 'open' LIMIT 1"
  )
    .bind(tenantId(), category, title)
    .first();
  if (duplicate) {
    return false;
  }
  await run(
    env,
    "INSERT INTO health_findings (id, tenant_id, severity, category, title, detail, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    createId("health"),
    tenantId(),
    severity,
    category,
    title,
    `${detail} Target: ${target}`,
    "open",
    nowIso(),
    null
  );
  return true;
}
