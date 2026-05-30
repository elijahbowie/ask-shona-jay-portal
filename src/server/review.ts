import type { AdminReviewData, AdminReviewItem } from "../shared/types";
import { all, tenantId } from "./db";

export async function buildAdminReview(env: Env): Promise<AdminReviewData> {
  const [unanswered, lowConfidence, repeated, gaps, pages] = await Promise.all([
    unansweredQuestions(env),
    lowConfidenceAnswers(env),
    repeatedConfusion(env),
    contentGaps(env),
    pagesNeedingReview(env)
  ]);
  return {
    unansweredQuestions: unanswered,
    lowConfidenceAnswers: lowConfidence,
    repeatedConfusion: repeated,
    contentGaps: gaps,
    pagesNeedingReview: pages
  };
}

async function unansweredQuestions(env: Env): Promise<AdminReviewItem[]> {
  const rows = await all<any>(
    env,
    `SELECT question, COUNT(*) AS total, MAX(created_at) AS last_seen
     FROM conversations
     WHERE tenant_id = ? AND answer_state = 'cannot_answer_from_approved_sources'
     GROUP BY question
     ORDER BY total DESC, last_seen DESC
     LIMIT 12`,
    tenantId()
  );
  return rows.map((row) => ({
    id: `unanswered:${row.question}`,
    label: row.question,
    detail: "No approved source supported a client-facing answer.",
    severity: "high",
    category: "unanswered",
    count: Number(row.total),
    createdAt: row.last_seen
  }));
}

async function lowConfidenceAnswers(env: Env): Promise<AdminReviewItem[]> {
  const rows = await all<any>(
    env,
    `SELECT id, question, confidence, answer_state, created_at
     FROM conversations
     WHERE tenant_id = ? AND confidence < 0.46
     ORDER BY created_at DESC
     LIMIT 12`,
    tenantId()
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.question,
    detail: `Confidence ${Number(row.confidence).toFixed(2)} · ${row.answer_state}`,
    severity: "medium",
    category: "low_confidence",
    createdAt: row.created_at
  }));
}

async function repeatedConfusion(env: Env): Promise<AdminReviewItem[]> {
  const rows = await all<any>(
    env,
    `SELECT LOWER(TRIM(question)) AS normalized_question, COUNT(*) AS total, MAX(created_at) AS last_seen
     FROM conversations
     WHERE tenant_id = ?
     GROUP BY normalized_question
     HAVING total >= 2
     ORDER BY total DESC, last_seen DESC
     LIMIT 12`,
    tenantId()
  );
  const feedbackRows = await all<any>(
    env,
    `SELECT c.question, COUNT(*) AS total, MAX(f.created_at) AS last_seen
     FROM feedback f
     JOIN conversations c ON c.id = f.conversation_id
     WHERE f.tenant_id = ? AND f.rating = 'down'
     GROUP BY c.question
     ORDER BY total DESC, last_seen DESC
     LIMIT 12`,
    tenantId()
  );
  const items = [
    ...rows.map((row) => ({
      id: `repeat:${row.normalized_question}`,
      label: row.normalized_question,
      detail: "Clients asked this or a near-identical question more than once.",
      severity: "medium" as const,
      category: "repeated_question",
      count: Number(row.total),
      createdAt: row.last_seen
    })),
    ...feedbackRows.map((row) => ({
      id: `feedback:${row.question}`,
      label: row.question,
      detail: "Clients marked this answer as not helpful.",
      severity: "medium" as const,
      category: "negative_feedback",
      count: Number(row.total),
      createdAt: row.last_seen
    }))
  ];
  return items.slice(0, 12);
}

async function contentGaps(env: Env): Promise<AdminReviewItem[]> {
  const rows = await all<any>(
    env,
    `SELECT id, title, detail, severity, category, created_at
     FROM health_findings
     WHERE tenant_id = ? AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 12`,
    tenantId()
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    detail: row.detail,
    severity: row.severity,
    category: row.category,
    createdAt: row.created_at
  }));
}

async function pagesNeedingReview(env: Env): Promise<AdminReviewItem[]> {
  const rows = await all<any>(
    env,
    `SELECT w.id, w.title, w.slug, w.strategy_key, w.status, w.effective_year, w.updated_at,
       COUNT(a.id) AS asset_count
     FROM wiki_pages w
     LEFT JOIN download_assets a ON a.tenant_id = w.tenant_id
       AND a.linked_slug = w.slug
       AND a.status = 'published'
     WHERE w.tenant_id = ?
     GROUP BY w.id
     HAVING w.status != 'published'
       OR w.effective_year < '2026'
       OR (w.strategy_key LIKE '%kit%' AND asset_count = 0)
       OR (w.strategy_key LIKE '%packet%' AND asset_count = 0)
       OR (w.strategy_key LIKE '%worksheet%' AND asset_count = 0)
       OR (w.strategy_key LIKE '%checklist%' AND asset_count = 0)
     ORDER BY w.updated_at DESC
     LIMIT 20`,
    tenantId()
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    detail: row.status !== "published"
      ? `Status is ${row.status}.`
      : Number(row.asset_count) === 0
        ? "Implementation page is missing a published downloadable asset."
        : `Effective year is ${row.effective_year}.`,
    severity: row.status !== "published" ? "high" : "medium",
    category: "page_review",
    targetUrl: `/learn/${row.slug}`,
    count: Number(row.asset_count),
    createdAt: row.updated_at
  }));
}
