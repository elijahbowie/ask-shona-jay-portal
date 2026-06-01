import { createId, nowIso } from "./crypto";
import { all, recordAuditEvent, run, tenantId } from "./db";

const PLAYBOOK_SECTION_GROUPS: Array<[string, string[]]> = [
  ["applicability", ["Best Fit", "Who This Applies To", "Who This Is For", "Who this strategy applies to"]],
  ["non-fit guidance", ["When This Is Not A Fit", "Who This Is Not For", "Who should not implement without review"]],
  ["implementation workflow", ["Implementation Steps", "Step-By-Step Implementation Notes", "Step-by-step implementation workflow"]],
  ["records", ["Documentation File", "Documents To Gather", "Required documents and records"]],
  ["timing", ["Operating Rhythm", "Timing", "Deadlines", "Timing and deadlines"]],
  ["caveats", ["Stop Before You", "Freshness Review", "Entity/payroll/state/federal/current-year caveats"]],
  ["common mistakes", ["Common Mistakes"]],
  ["review gate", ["Team Handoff", "Escalation Triggers", "Advisor review gates", "Before You Act"]],
  ["completion checklist", ["Completion Checklist", "Next Actions", "Setup Checklist"]],
  ["downloads", ["Related Downloads", "Downloads", "Templates", "Worksheets"]],
  ["before-you-act language", ["Before You Act", "Preview Boundary", "Before you act"]]
];

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

  const playbookGaps = await implementationPlaybookGaps(env);
  for (const gap of playbookGaps) {
    if (await createFinding(env, gap.severity, gap.category, gap.title, gap.detail, gap.target)) {
      created += 1;
    }
  }

  await recordAuditEvent(env, {
    actor: "system",
    action: "health.run",
    targetType: "health",
    targetId: "health_run",
    metadata: { created },
    at: now
  });
  return created;
}

async function implementationPlaybookGaps(env: Env): Promise<Array<{ severity: string; category: string; title: string; detail: string; target: string }>> {
  const pages = await all<any>(
    env,
    `SELECT w.id, w.title, w.slug, w.compiled_r2_key, COUNT(a.id) AS asset_count
     FROM wiki_pages w
     LEFT JOIN download_assets a ON a.tenant_id = w.tenant_id
       AND a.linked_slug = w.slug
       AND a.status = 'published'
     WHERE w.tenant_id = ? AND w.status = 'published'
     GROUP BY w.id
     ORDER BY w.title`,
    tenantId()
  );
  const gaps: Array<{ severity: string; category: string; title: string; detail: string; target: string }> = [];
  for (const page of pages) {
    if (Number(page.asset_count) === 0) {
      gaps.push({
        severity: "medium",
        category: "missing_download_asset",
        title: `Missing download asset: ${page.title}`,
        detail: "Published wiki pages should have a related worksheet, checklist, template, or packet attached.",
        target: page.slug
      });
    }
    if (!page.compiled_r2_key) {
      gaps.push({
        severity: "high",
        category: "implementation_playbook_gap",
        title: `Missing compiled content: ${page.title}`,
        detail: "Published wiki page has no compiled markdown key to inspect for implementation-readiness.",
        target: page.slug
      });
      continue;
    }
    const object = await env.CONTENT_BUCKET.get(page.compiled_r2_key);
    if (!object) {
      gaps.push({
        severity: "high",
        category: "implementation_playbook_gap",
        title: `Missing compiled content: ${page.title}`,
        detail: "Published wiki page compiled markdown is missing from R2.",
        target: page.slug
      });
      continue;
    }
    const markdown = await object.text();
    const headings = headingsFromMarkdown(markdown);
    const missingSections = PLAYBOOK_SECTION_GROUPS
      .filter(([, aliases]) => !hasAnyHeading(headings, aliases))
      .map(([label]) => label);
    if (missingSections.length > 0) {
      gaps.push({
        severity: "medium",
        category: "implementation_playbook_gap",
        title: `Implementation playbook gap: ${page.title}`,
        detail: `Missing implementation section(s): ${missingSections.join(", ")}.`,
        target: page.slug
      });
    }
  }
  return gaps;
}

function headingsFromMarkdown(markdown: string): string[] {
  return [...markdown.matchAll(/^#{2,4}\s+(.+)$/gm)].map((match) => match[1].replace(/\s+#*$/g, "").trim().toLowerCase());
}

function hasAnyHeading(headings: string[], aliases: string[]): boolean {
  return headings.some((heading) => aliases.some((alias) => heading.includes(alias.toLowerCase())));
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
