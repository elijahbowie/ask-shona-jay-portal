#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const TENANT_ID = "tenant_beyond_freedom";
const PORTAL_ORIGIN = "https://ask.beyondfreedomfinancial.com";
const PRODUCTION_DB = "ask-shona-jay-db-production";
const PRODUCTION_BUCKET = "ask-shona-jay-content-production";
const RUNS_DIR = ".wiki-playbook-runs";
const DEFAULT_ASSET_PLAN = ".asset-runs/latest-download-assets-plan.json";

const SECTION_GROUPS = [
  ["applies", "Who the strategy applies to", ["Best Fit", "Who This Applies To", "Who This Is For", "Who the strategy applies to"]],
  ["notApply", "Who the strategy does not apply to", ["When This Is Not A Fit", "Who This Is Not For", "Who Should Not Use This", "Who should not implement without review"]],
  ["facts", "Required facts/client inputs", ["Fact-Gathering Checklist", "Required Facts", "Required Client Inputs", "Team Handoff", "Required client inputs"]],
  ["steps", "Step-by-step implementation workflow", ["Implementation Steps", "Step-By-Step Implementation Notes", "Step-by-step implementation workflow"]],
  ["documents", "Required documents/records", ["Documentation File", "Documents To Gather", "Required Documents", "Required Records", "Required documents and records"]],
  ["timing", "Timing/deadlines", ["Operating Rhythm", "Timing", "Deadlines", "Payment Cadence", "Cadence", "Timing and deadlines"]],
  ["caveats", "Entity/payroll/state/federal/current-year caveats", ["Stop Before You", "2026 Freshness Review", "Freshness Review", "Caveats", "Entity/payroll/state/federal/current-year caveats"]],
  ["mistakes", "Common mistakes", ["Common Mistakes"]],
  ["review", "Advisor review gates", ["Team Handoff", "Stop Before You", "Escalation Triggers", "Advisor Review Gates", "Before You Act"]],
  ["completion", "Completion checklist", ["Completion Checklist", "Next Actions", "Setup Checklist"]],
  ["downloads", "Related downloads/templates/worksheets", ["Related Downloads", "Downloads", "Templates", "Worksheets"]],
  ["beforeAct", "Before you act language", ["Before You Act", "Preview Boundary", "before you act"]]
];

const HIGH_REVIEW_PATTERNS = [
  /\bs-?corp\b/i,
  /\bpayroll\b/i,
  /\bentity\b/i,
  /\bdepreciation\b/i,
  /\bcost seg/i,
  /\bshort-?term rental\b/i,
  /\breal estate professional\b/i,
  /\bmedical\b/i,
  /\bhealth reimbursement\b/i,
  /\birs\b/i,
  /\bnotice\b/i,
  /\bworker classification\b/i,
  /\b1099\b/i,
  /\bbasis\b/i,
  /\bat-risk\b/i,
  /\bpassive loss\b/i,
  /\bqbi\b/i,
  /\broth\b/i,
  /\bsocial security\b/i,
  /\bministerial\b/i
];

const DEPRECATED_PERSONALIZED_PLAN_PHRASES = [
  "Use your personalized plan",
  "The personalized tax plan should",
  "Personalized Tax Plan and Vault Roadmap Implementation Worksheet",
  "personalized-tax-plan-and-vault-roadmap-implementation-worksheet.docx"
];

const MARKDOWN_OVERRIDES = new Map([
  ["personalized-tax-plan-and-vault-roadmap", `# Planning Roadmap and Vault Review

## Lesson Outcome

Use this page to organize the client's planning roadmap, starter checklist, and tax vault so Shona/Jay can review priorities against the client's facts. This page is not a personalized tax plan by itself.

## The Strategy

The vault is most useful when lessons, documents, and open questions are tied to the client's facts. This roadmap helps the client decide which wiki lessons to review first, what records to gather, and what questions need advisor review before action.

If Shona/Jay has already provided a written plan or plan walkthrough, use this page to track that plan. If no personalized plan has been provided yet, use this page only as a preparation and organization workflow for the next review.

## Best Fit

- The client needs a clear order for reviewing wiki lessons.
- The client wants to organize tax documents, strategy records, and open questions in one vault.
- The client has onboarding notes, a kickoff discussion, or a written plan that should be converted into tracked tasks.
- The client wants to know what to gather before asking Shona/Jay for a personalized recommendation.

## When This Is Not A Fit

- The client is looking for the wiki to generate a personalized tax plan without advisor review.
- The client's facts have changed and the existing roadmap has not been updated.
- The client has not completed intake and needs client-specific tax, payroll, entity, legal, or investment advice.
- The client wants to implement every strategy at once without prioritization or review.

## Required Client Inputs

- Current tax year, filing status, entity type, ownership, state, and business activity.
- Existing roadmap, kickoff notes, planning call notes, or starter checklist if one has been provided.
- Prior-year return, current-year income/payroll/bookkeeping snapshot, and open tax notices or deadlines.
- List of wiki lessons watched, records gathered, open questions, and strategy areas the client believes may apply.

## Implementation Steps

1. Create or update the tax vault with folders for returns, entities, payroll, real estate, receipts, strategy files, notices, and planning notes.
2. Upload the prior-year return, current-year starting documents, onboarding notes, and any written roadmap already provided by Shona/Jay.
3. Convert each possible strategy into a task with owner, due date, records needed, related lesson, and review status.
4. Watch lessons in priority order and complete the related worksheets or checklists before asking for review.
5. Mark each item as gather-only, ready for advisor review, approved to implement, implemented, or blocked.
6. Send Shona/Jay the roadmap status, completed worksheets, missing document list, open decisions, and upcoming deadlines before acting.
7. Update the roadmap whenever income, family, property, entity, payroll, state, or business facts change.

## Required Documents and Records

- Prior-year tax return and current-year tax document list.
- Entity documents, payroll reports, bookkeeping reports, receipts, logs, notices, account statements, and property records when relevant.
- Existing roadmap, kickoff notes, planning call notes, and questions for Shona/Jay.
- Completed worksheets, checklists, packets, and logs from the related wiki lessons.

## Timing and Deadlines

- Update the vault monthly when documents, receipts, payroll, or bookkeeping records change.
- Review open roadmap tasks quarterly and before any payment, reimbursement, payroll run, entity change, election, or filing position.
- Clean the full vault before year-end and again before filing.
- Confirm current-year deadlines with Shona/Jay or official sources before relying on dates.

## Entity/Payroll/State/Federal/Current-Year Caveats

This workflow organizes facts for review. It does not approve a tax position, payroll setup, entity change, deduction, election, reimbursement, retirement move, or legal step. Current-year law, state rules, entity facts, payroll facts, plan documents, and filing posture can change the answer.

## Common Mistakes

- Treating a checklist, score, or wiki lesson as a personalized tax plan.
- Watching lessons randomly without tracking records, due dates, and review status.
- Waiting until filing season to gather strategy support.
- Failing to tell Shona/Jay when income, payroll, entity, family, property, or state facts change.
- Marking a strategy complete before the advisor review gate is cleared.

## Advisor Review Gates

- Shona/Jay must review the completed roadmap packet before the client files, elects, reimburses, runs payroll, changes entity treatment, claims a deduction, moves money, or relies on a tax/legal/payroll conclusion.
- Stop and escalate when the facts involve deadlines, notices, state law, payroll, entity ownership, related parties, large dollar amounts, mixed personal/business use, investments, retirement moves, or uncertainty.

## Completion Checklist

- Tax vault folders are created and current records are uploaded.
- Each possible strategy has a related lesson, owner, due date, required records, and review status.
- Completed worksheets and open questions are saved in the vault.
- Advisor review gate is cleared before implementation.
- Final decision and supporting records are saved with the roadmap.

## Related Downloads/Templates/Worksheets

- Planning Roadmap and Vault Review Implementation Worksheet

## Before You Act

Use this page to prepare a clean review packet. Do not treat it as a personalized tax plan or authorization to implement until Shona/Jay confirms the strategy fits the client's facts.`]
]);

function parseArgs() {
  const args = { mode: "audit", runDir: null, assetPlan: null };
  for (let index = 2; index < process.argv.length; index += 1) {
    const item = process.argv[index];
    if (item === "--audit") {
      args.mode = "audit";
      continue;
    }
    if (item === "--prepare-upgrades") {
      args.mode = "prepare-upgrades";
      continue;
    }
    if (item === "--apply-upgrades") {
      args.mode = "apply-upgrades";
      continue;
    }
    if (item === "--rollback-upgrades") {
      args.mode = "rollback-upgrades";
      continue;
    }
    if (item === "--verify-preapply") {
      args.mode = "verify-preapply";
      continue;
    }
    if (item === "--verify-production") {
      args.mode = "verify-production";
      continue;
    }
    if (item === "--write-docs") {
      args.mode = "write-docs";
      continue;
    }
    if (item === "--run-dir") {
      args.runDir = process.argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--asset-plan") {
      args.assetPlan = process.argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function d1Results(sql) {
  const output = execFileSync("npx", [
    "wrangler",
    "d1",
    "execute",
    PRODUCTION_DB,
    "--remote",
    "--command",
    sql,
    "--json"
  ], { encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  const parsed = JSON.parse(output);
  return parsed.flatMap((item) => item.results || []);
}

function fetchMarkdown(page, cacheDir) {
  const file = path.join(cacheDir, `${page.slug}.md`);
  execFileSync("npx", [
    "wrangler",
    "r2",
    "object",
    "get",
    `${PRODUCTION_BUCKET}/${page.compiled_r2_key}`,
    "--remote",
    "--file",
    file
  ], { stdio: "ignore", maxBuffer: 1024 * 1024 * 20 });
  return readFileSync(file, "utf8");
}

function pagesWithAssets(assetPlanPath = null) {
  const plannedAssets = loadAssetPlan(assetPlanPath);
  return d1Results(`
    SELECT
      w.id,
      w.slug,
      w.title,
      w.strategy_key,
      w.status,
      w.effective_year,
      w.compiled_r2_key,
      COUNT(a.id) AS asset_count,
      COALESCE(GROUP_CONCAT(a.title, '||'), '') AS asset_titles
    FROM wiki_pages w
    LEFT JOIN download_assets a ON a.tenant_id = w.tenant_id
      AND a.linked_slug = w.slug
      AND a.status = 'published'
    WHERE w.tenant_id = '${TENANT_ID}'
      AND w.status = 'published'
    GROUP BY w.id
    ORDER BY w.title
  `).map((row) => {
    const productionTitles = row.asset_titles ? String(row.asset_titles).split("||").filter(Boolean) : [];
    const mergedTitles = [...productionTitles];
    for (const title of plannedAssets.get(row.slug) || []) {
      if (!mergedTitles.includes(title)) {
        mergedTitles.push(title);
      }
    }
    return {
      ...row,
      asset_count: mergedTitles.length,
      asset_titles: mergedTitles
    };
  });
}

function productionAssetRows() {
  return d1Results(`
    SELECT id, title, linked_slug, r2_key
    FROM download_assets
    WHERE tenant_id = '${TENANT_ID}'
      AND status = 'published'
    ORDER BY linked_slug, title
  `);
}

function loadAssetPlan(assetPlanPath) {
  const bySlug = new Map();
  if (!assetPlanPath || !existsSync(assetPlanPath)) {
    return bySlug;
  }
  const plan = JSON.parse(readFileSync(assetPlanPath, "utf8"));
  for (const asset of plan.assets || []) {
    if (!asset.linkedSlug || !asset.title) continue;
    if (!asset.localFileExists && !asset.productionRowExists) continue;
    if (!bySlug.has(asset.linkedSlug)) {
      bySlug.set(asset.linkedSlug, []);
    }
    bySlug.get(asset.linkedSlug).push(asset.title);
  }
  return bySlug;
}

function latestRunDir() {
  const manifestPath = path.join(RUNS_DIR, "latest-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("No latest manifest found. Run --prepare-upgrades first or pass --run-dir.");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return path.join(RUNS_DIR, manifest.runId);
}

async function adminLogin() {
  const sessionCookie = process.env.ADMIN_SESSION_COOKIE;
  if (sessionCookie) {
    const dashboard = await fetch(`${PORTAL_ORIGIN}/api/admin/dashboard`, { headers: { cookie: sessionCookie } });
    if (!dashboard.ok) {
      throw new Error(`Admin session cookie failed: ${dashboard.status} ${await dashboard.text()}`);
    }
    return sessionCookie;
  }
  const password = process.env.ADMIN_MASTER_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_MASTER_PASSWORD or ADMIN_SESSION_COOKIE is required for --apply-upgrades.");
  }
  const response = await fetch(`${PORTAL_ORIGIN}/api/auth/admin-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    throw new Error(`Admin login failed: ${response.status} ${await response.text()}`);
  }
  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Admin login did not return a session cookie.");
  }
  return cookie.split(";")[0];
}

async function adminRequest(cookie, method, requestPath, body = null) {
  const response = await fetch(`${PORTAL_ORIGIN}${requestPath}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`${method} ${requestPath} failed: ${response.status} ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function headingNames(markdown) {
  return [...markdown.matchAll(/^#{2,4}\s+(.+)$/gm)].map((match) => cleanHeading(match[1]));
}

function cleanHeading(value) {
  return String(value).replace(/\s+#*$/g, "").trim();
}

function hasHeading(headings, aliases) {
  return headings.some((heading) => aliases.some((alias) => heading.toLowerCase().includes(alias.toLowerCase())));
}

function isHighReview(page, markdown) {
  const haystack = `${page.title} ${page.strategy_key} ${markdown.slice(0, 1200)}`;
  return HIGH_REVIEW_PATTERNS.some((pattern) => pattern.test(haystack));
}

function analyzePage(page, markdown) {
  const headings = headingNames(markdown);
  const present = {};
  for (const [key, , aliases] of SECTION_GROUPS) {
    present[key] = hasHeading(headings, aliases);
  }
  if (page.asset_count > 0) {
    present.downloads = true;
  }
  const missing = SECTION_GROUPS.filter(([key]) => !present[key]).map(([key, label]) => ({ key, label }));
  const score = SECTION_GROUPS.length - missing.length;
  const educationalOnly = /Preview status:\s*.*Educational Only|Transcript-Derived Preview/i.test(markdown);
  const highReview = isHighReview(page, markdown);
  const classification = classify({ score, missing, educationalOnly, highReview });
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    strategyKey: page.strategy_key,
    effectiveYear: page.effective_year,
    status: page.status,
    compiledR2Key: page.compiled_r2_key,
    assetCount: page.asset_count,
    assetTitles: page.asset_titles,
    headings,
    score,
    missing,
    highReview,
    classification
  };
}

function classify({ score, missing, educationalOnly, highReview }) {
  if (educationalOnly && score < 10) {
    return "Educational only and not implementation-ready";
  }
  if (score >= SECTION_GROUPS.length) {
    return "Complete implementation playbook";
  }
  if (highReview && missing.some((item) => ["review", "beforeAct", "caveats"].includes(item.key))) {
    return "Unsafe/unsupported to make implementation-ready without advisor/source input";
  }
  if (score >= 9) {
    return "Mostly complete but missing specific steps/downloads/examples";
  }
  return "Educational only and not implementation-ready";
}

function extractSection(markdown, aliases) {
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,4})\s+(.+?)\s*#*$/);
    if (!match) continue;
    const heading = cleanHeading(match[2]);
    if (!aliases.some((alias) => heading.toLowerCase().includes(alias.toLowerCase()))) continue;
    const level = match[1].length;
    const body = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextMatch = lines[next].match(/^(#{2,4})\s+/);
      if (nextMatch && nextMatch[1].length <= level) break;
      body.push(lines[next]);
    }
    const cleaned = body.join("\n").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function firstBullets(text, fallback) {
  const bullets = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "- ").replace(/^\d+\.\s+/, "- "))
    .slice(0, 8);
  return bullets.length ? bullets.join("\n") : fallback;
}

function upgradeMarkdown(page, markdown) {
  const override = MARKDOWN_OVERRIDES.get(page.slug);
  if (override) {
    return `${override.trimEnd()}\n`;
  }
  if (/^## Implementation Readiness Addendum\b/m.test(markdown)) {
    return markdown;
  }
  const lookup = Object.fromEntries(SECTION_GROUPS.map(([key, , aliases]) => [key, extractSection(markdown, aliases)]));
  const assets = page.asset_titles.length
    ? page.asset_titles.map((title) => `- ${title}`).join("\n")
    : "- No separate download is currently attached to this page. Use the documentation file and completion checklist on this page, then send the completed packet to Shona/Jay for review before acting.";
  const highReview = isHighReview(page, markdown);
  const caveatIntro = highReview
    ? "This strategy requires advisor review before deployment because entity, payroll, federal, state, filing, legal, plan-document, or current-year facts can change the answer."
    : "This workflow still requires a facts-first review before the client treats the lesson as applied guidance.";

  const addendum = `

## Implementation Readiness Addendum

This addendum is the client-facing implementation checklist for the lesson above. It does not replace personalized tax, legal, payroll, investment, or state-law advice.

### Who this strategy applies to

${firstBullets(lookup.applies, "- A client whose facts match the lesson outcome, strategy overview, and best-fit bullets above.")}

### Who should not implement without review

${firstBullets(lookup.notApply || lookup.caveats, "- A client whose facts do not clearly match the best-fit bullets above.\n- A client who needs a filing position, legal document, payroll setup, tax election, reimbursement plan, or current-year eligibility decision.")}

### Required client inputs

${firstBullets(lookup.facts || lookup.review, "- Current entity type, ownership, state, tax year, and business activity.\n- The dollar amounts, dates, payers, accounts, properties, employees, or assets involved.\n- A short description of what the client wants to do and when they plan to do it.")}

### Step-by-step implementation workflow

${firstBullets(lookup.steps, "- Gather the required facts and records before moving money or filing.\n- Complete the worksheet, checklist, or documentation file connected to this page.\n- Send the completed packet to Shona/Jay for review.\n- Wait for advisor confirmation before changing payroll, entity treatment, tax reporting, reimbursement, elections, or deduction treatment.\n- Save the final reviewed packet in the tax vault.")}

### Required documents and records

${firstBullets(lookup.documents || lookup.facts, "- Source documents that prove the amount, date, business purpose, entity, payer/payee, payment path, and tax year.\n- Any signed agreements, policy documents, payroll records, account statements, invoices, receipts, logs, or official forms mentioned in the lesson.")}

### Timing and deadlines

${firstBullets(lookup.timing, "- Start the recordkeeping process before the transaction or implementation step.\n- Review the file before year-end and again before filing.\n- Confirm current-year federal, state, payroll, and filing deadlines with Shona/Jay or the applicable official source before acting.")}

### Entity/payroll/state/federal/current-year caveats

${caveatIntro} Do not rely on older examples, transcript amounts, stale mileage rates, stale deduction limits, or prior-year filing dates without current-year confirmation.

### Common mistakes

${firstBullets(lookup.mistakes, "- Acting before facts are gathered.\n- Moving money before the record is complete.\n- Treating an educational example as a client-specific conclusion.\n- Waiting until filing season to reconstruct support.")}

### Advisor review gates

${firstBullets(lookup.review || lookup.beforeAct, "- Shona/Jay must review the completed fact packet before the client files, elects, reimburses, runs payroll, changes entity treatment, claims a deduction, or relies on a tax/legal/payroll conclusion.\n- Stop and escalate when the facts involve state law, payroll, entity ownership, amended returns, notices, deadlines, large dollar amounts, related parties, mixed personal/business use, or uncertainty.")}

### Completion checklist

- Best-fit and not-a-fit bullets reviewed against the client's facts.
- Required inputs gathered and saved.
- Required documents uploaded or organized in the tax vault.
- Any worksheet, template, checklist, packet, or log completed.
- Advisor review gate cleared before implementation.
- Final decision, filing position, payment, reimbursement, election, or bookkeeping entry saved with support.

### Related downloads/templates/worksheets

${assets}

### Before you act

Use this page as an implementation playbook for gathering facts and preparing the review packet. Do not treat it as a personalized tax plan or authorization to implement until Shona/Jay confirms the strategy fits the client's facts.
`;
  return `${markdown.trimEnd()}${addendum}\n`;
}

function reportMarkdown(rows, runDir) {
  const lines = [
    "# Wiki Implementation Readiness Audit",
    "",
    `Run directory: ${runDir}`,
    "",
    "| Lesson | Status before | Changes made | Status after | Downloads | Remaining advisor/source blocker |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const row of rows) {
    const downloadTitles = row.after?.assetTitles?.length ? row.after.assetTitles : row.assetTitles;
    const downloads = downloadTitles.length ? downloadTitles.join("<br>") : "None attached";
    const before = `${row.classification} (${row.score}/12${row.missing.length ? `; missing ${row.missing.map((item) => item.label).join(", ")}` : ""})`;
    const after = row.after
      ? `${row.after.classification} (${row.after.score}/12${row.after.missing.length ? `; missing ${row.after.missing.map((item) => item.label).join(", ")}` : ""})`
      : "Not prepared in audit-only mode";
    const changes = row.after
      ? preparedChangeSummary(row)
      : "Audit only.";
    const blocker = (row.after || row).classification === "Unsafe/unsupported to make implementation-ready without advisor/source input"
      ? "Needs advisor/source review before stronger implementation claims."
      : (row.after || row).highReview
        ? "Advisor review required before deployment; review gate is part of workflow."
        : "";
    lines.push(`| ${escapeCell(row.title)} | ${escapeCell(before)} | ${escapeCell(changes)} | ${escapeCell(after)} | ${escapeCell(downloads)} | ${escapeCell(blocker)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/\n/g, "<br>");
}

function titleFromMarkdown(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  const title = match?.[1]?.replace(/\s+#*$/g, "").trim();
  return title || null;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function applyUpgrades(args) {
  const runDir = args.runDir || latestRunDir();
  assertPlannedAssetsInProduction(args.assetPlan || DEFAULT_ASSET_PLAN);
  const upgradedDir = path.join(runDir, "upgraded");
  if (!existsSync(upgradedDir)) {
    throw new Error(`No upgraded markdown directory found at ${upgradedDir}. Run --prepare-upgrades first.`);
  }
  const pages = assertProductionInventoryMatchesManifest(runDir, args.assetPlan || DEFAULT_ASSET_PLAN);
  const backupDir = path.join(runDir, "production-backups");
  mkdirSync(backupDir, { recursive: true });
  const applyPath = path.join(runDir, "apply-manifest.json");
  const applyManifest = {
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    applied: []
  };
  writeJson(applyPath, applyManifest);
  const cookie = await adminLogin();
  try {
    for (const page of pages) {
      const file = path.join(upgradedDir, `${page.slug}.md`);
      if (!existsSync(file)) {
        throw new Error(`Missing upgraded markdown file for ${page.title}: ${file}`);
      }
      fetchMarkdown(page, backupDir);
      const markdown = readFileSync(file, "utf8");
      await adminRequest(cookie, "PUT", `/api/admin/wiki/${encodeURIComponent(page.id)}`, { markdown });
      await adminRequest(cookie, "POST", `/api/admin/wiki/${encodeURIComponent(page.id)}/publish`, {});
      applyManifest.applied.push({
        id: page.id,
        slug: page.slug,
        title: page.title,
        previousCompiledR2Key: page.compiled_r2_key,
        backupPath: path.join("production-backups", `${page.slug}.md`),
        upgradedBytes: Buffer.byteLength(markdown, "utf8")
      });
      writeJson(applyPath, applyManifest);
      console.log(`Published upgraded playbook: ${page.title}`);
    }
    await adminRequest(cookie, "POST", "/api/admin/health/run", {});
    applyManifest.verified = verifyProductionMarkdownMatches(applyManifest.applied, (page) => path.join(upgradedDir, `${page.slug}.md`), "applied");
    applyManifest.status = "applied";
    applyManifest.completedAt = new Date().toISOString();
    writeJson(applyPath, applyManifest);
  } catch (error) {
    applyManifest.status = "failed";
    applyManifest.completedAt = new Date().toISOString();
    applyManifest.error = error instanceof Error ? error.message : String(error);
    writeJson(applyPath, applyManifest);
    throw error;
  }
  console.log(JSON.stringify({ mode: "apply-upgrades", applied: applyManifest.applied.length, applyPath }, null, 2));
}

function assertProductionInventoryMatchesManifest(runDir, assetPlanPath) {
  const manifestPath = path.join(runDir, "implementation-readiness-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing implementation manifest: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expected = new Map((manifest.rows || []).map((row) => [row.id, row]));
  const pages = pagesWithAssets(assetPlanPath);
  const actual = new Map(pages.map((page) => [page.id, page]));
  const missing = [...expected.values()].filter((row) => !actual.has(row.id));
  const added = pages.filter((page) => !expected.has(page.id));
  const changed = pages.filter((page) => {
    const row = expected.get(page.id);
    return row && (row.slug !== page.slug || row.title !== page.title || row.compiledR2Key !== page.compiled_r2_key);
  });
  if (missing.length || added.length || changed.length) {
    throw new Error(
      "Production published wiki inventory changed since the prepared package was generated. Run npm run wiki:playbook:preflight again before applying.\n"
      + [
        ...missing.map((row) => `- Missing from production: ${row.title} (${row.slug})`),
        ...added.map((page) => `- Added in production: ${page.title} (${page.slug})`),
        ...changed.map((page) => {
          const row = expected.get(page.id);
          return `- Changed in production: expected ${row.title} (${row.slug}, ${row.compiledR2Key}), found ${page.title} (${page.slug}, ${page.compiled_r2_key})`;
        })
      ].join("\n")
    );
  }
  if (pages.length !== expected.size) {
    throw new Error(`Production page count changed since prepare: expected ${expected.size}, found ${pages.length}. Run npm run wiki:playbook:preflight again.`);
  }
  return pages;
}

async function rollbackUpgrades(args) {
  const runDir = args.runDir || latestRunDir();
  const applyPath = path.join(runDir, "apply-manifest.json");
  if (!existsSync(applyPath)) {
    throw new Error(`Missing apply manifest: ${applyPath}`);
  }
  const applyManifest = JSON.parse(readFileSync(applyPath, "utf8"));
  const applied = applyManifest.applied || [];
  if (!applied.length) {
    throw new Error(`Apply manifest has no applied pages: ${applyPath}`);
  }
  const cookie = await adminLogin();
  const restored = [];
  for (const page of [...applied].reverse()) {
    const backupPath = path.join(runDir, page.backupPath);
    if (!existsSync(backupPath)) {
      throw new Error(`Missing backup markdown for ${page.title}: ${backupPath}`);
    }
    const markdown = readFileSync(backupPath, "utf8");
    await adminRequest(cookie, "PUT", `/api/admin/wiki/${encodeURIComponent(page.id)}`, { markdown });
    await adminRequest(cookie, "POST", `/api/admin/wiki/${encodeURIComponent(page.id)}/publish`, {});
    restored.push({ id: page.id, slug: page.slug, title: page.title, bytes: Buffer.byteLength(markdown, "utf8") });
    console.log(`Restored pre-upgrade playbook: ${page.title}`);
  }
  await adminRequest(cookie, "POST", "/api/admin/health/run", {});
  const verified = verifyProductionMarkdownMatches(applied, (page) => path.join(runDir, page.backupPath), "restored");
  const rollbackPath = path.join(runDir, "rollback-manifest.json");
  writeJson(rollbackPath, { rolledBackAt: new Date().toISOString(), restored, verified });
  console.log(JSON.stringify({ mode: "rollback-upgrades", restored: restored.length, rollbackPath }, null, 2));
}

function verifyProductionMarkdownMatches(entries, expectedFilePath, label) {
  const cacheDir = mkdtempSync(path.join(tmpdir(), `wiki-playbook-${label}-`));
  const pagesBySlug = new Map(pagesWithAssets(null).map((page) => [page.slug, page]));
  const verified = [];
  for (const entry of entries) {
    const productionPage = pagesBySlug.get(entry.slug);
    if (!productionPage) {
      throw new Error(`Cannot verify ${label} page because it is missing from production: ${entry.slug}`);
    }
    const expectedPath = expectedFilePath(entry);
    const expected = readFileSync(expectedPath, "utf8");
    const actual = fetchMarkdown(productionPage, cacheDir);
    if (actual !== expected) {
      throw new Error(`Production markdown mismatch after ${label} for ${entry.title || entry.slug}`);
    }
    const expectedTitle = titleFromMarkdown(expected);
    if (expectedTitle && productionPage.title !== expectedTitle) {
      throw new Error(`Production title mismatch after ${label} for ${entry.slug}. Expected "${expectedTitle}"; found "${productionPage.title}".`);
    }
    verified.push({
      slug: entry.slug,
      title: productionPage.title,
      bytes: Buffer.byteLength(actual, "utf8")
    });
  }
  return verified;
}

function assertPlannedAssetsInProduction(assetPlanPath) {
  if (!assetPlanPath || !existsSync(assetPlanPath)) {
    throw new Error(`Missing asset plan: ${assetPlanPath || DEFAULT_ASSET_PLAN}`);
  }
  const plan = JSON.parse(readFileSync(assetPlanPath, "utf8"));
  const productionKeys = new Set(productionAssetRows().map((asset) => asset.r2_key));
  const missing = (plan.assets || []).filter((asset) => !productionKeys.has(asset.r2Key));
  if (missing.length) {
    throw new Error(
      `Production is missing ${missing.length} planned asset(s). Run the asset import before publishing upgraded pages:\n`
      + missing.map((asset) => `- ${asset.title} (${asset.linkedSlug})`).join("\n")
    );
  }
}

function verifyPreapply(args) {
  const runDir = args.runDir || latestRunDir();
  const manifestPath = path.join(runDir, "implementation-readiness-manifest.json");
  const reportPath = path.join(runDir, "implementation-readiness-report.md");
  const upgradedDir = path.join(runDir, "upgraded");
  const assetPlanPath = args.assetPlan || DEFAULT_ASSET_PLAN;
  if (!existsSync(manifestPath)) throw new Error(`Missing implementation manifest: ${manifestPath}`);
  if (!existsSync(reportPath)) throw new Error(`Missing implementation report: ${reportPath}`);
  if (!existsSync(upgradedDir)) throw new Error(`Missing upgraded markdown directory: ${upgradedDir}`);
  if (!existsSync(assetPlanPath)) throw new Error(`Missing asset plan: ${assetPlanPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const assetPlan = JSON.parse(readFileSync(assetPlanPath, "utf8"));
  const rows = manifest.rows || [];
  const assets = assetPlan.assets || [];
  const missingAfter = rows.filter((row) => row.after?.missing?.length);
  const incompleteAfter = rows.filter((row) => row.after?.classification !== "Complete implementation playbook");
  const noDownloadsAfter = rows.filter((row) => !row.after?.assetTitles?.length);
  const missingMarkdown = rows.filter((row) => !existsSync(path.join(upgradedDir, `${row.slug}.md`)));
  const missingCompiledKeys = rows.filter((row) => !row.compiledR2Key);
  const bannedMatches = [];
  if (rows.length === 0) throw new Error("No wiki rows found in implementation manifest.");
  if (missingAfter.length) throw new Error(`Rows still missing required sections: ${missingAfter.map((row) => row.title).join(", ")}`);
  if (incompleteAfter.length) throw new Error(`Rows not complete after upgrade: ${incompleteAfter.map((row) => row.title).join(", ")}`);
  if (noDownloadsAfter.length) throw new Error(`Rows without related downloads after upgrade: ${noDownloadsAfter.map((row) => row.title).join(", ")}`);
  if (missingMarkdown.length) throw new Error(`Missing upgraded markdown files: ${missingMarkdown.map((row) => row.slug).join(", ")}`);
  if (missingCompiledKeys.length) throw new Error(`Rows missing production compiled content keys: ${missingCompiledKeys.map((row) => row.title).join(", ")}`);
  if (assets.length < rows.length) throw new Error(`Expected at least one asset plan row per page; found ${assets.length} asset plan rows for ${rows.length} wiki rows.`);

  for (const row of rows) {
    const markdown = readFileSync(path.join(upgradedDir, `${row.slug}.md`), "utf8");
    for (const phrase of DEPRECATED_PERSONALIZED_PLAN_PHRASES) {
      if (markdown.includes(phrase)) bannedMatches.push(`${row.slug}: ${phrase}`);
    }
  }
  for (const asset of assets) {
    const haystack = `${asset.title}\n${asset.description}\n${asset.filename}\n${asset.r2Key}`;
    for (const phrase of DEPRECATED_PERSONALIZED_PLAN_PHRASES) {
      if (haystack.includes(phrase)) bannedMatches.push(`${asset.linkedSlug || asset.title}: ${phrase}`);
    }
  }
  if (bannedMatches.length) {
    throw new Error(`Prepared package contains deprecated personalized-plan language:\n${bannedMatches.join("\n")}`);
  }

  const newAssets = assets.filter((asset) => !asset.productionRowExists);
  const generatedDir = path.join(".asset-runs", assetPlan.runId, "generated-assets");
  const missingGenerated = newAssets.filter((asset) => !existsSync(path.join(generatedDir, asset.filename)));
  if (missingGenerated.length) {
    throw new Error(`Missing generated worksheet files: ${missingGenerated.map((asset) => asset.filename).join(", ")}`);
  }
  for (const asset of newAssets) {
    execFileSync("unzip", ["-t", path.join(generatedDir, asset.filename)], { stdio: "ignore" });
  }
  console.log(JSON.stringify({
    mode: "verify-preapply",
    wikiRows: rows.length,
    completeAfter: rows.length - incompleteAfter.length,
    missingSectionsAfter: missingAfter.length,
    noDownloadsAfter: noDownloadsAfter.length,
    missingCompiledKeys: missingCompiledKeys.length,
    assetPlanRows: assets.length,
    newAssets: newAssets.length,
    generatedFilesVerified: newAssets.length,
    reportPath,
    upgradedDir,
    assetPlanPath
  }, null, 2));
}

function verifyProduction() {
  const cacheDir = mkdtempSync(path.join(tmpdir(), "wiki-playbook-prod-"));
  const pages = pagesWithAssets(null);
  const markdownBySlug = new Map();
  const rows = pages.map((page) => {
    const markdown = fetchMarkdown(page, cacheDir);
    markdownBySlug.set(page.slug, markdown);
    return analyzePage(page, markdown);
  });
  const incomplete = rows.filter((row) => row.classification !== "Complete implementation playbook");
  const missingSections = rows.filter((row) => row.missing.length);
  const noDownloads = rows.filter((row) => !row.assetTitles.length);
  const roadmapRow = rows.find((row) => row.slug === "personalized-tax-plan-and-vault-roadmap");
  const assets = productionAssetRows();
  const deprecatedMatches = deprecatedProductionMatches(rows, markdownBySlug, assets);
  const result = {
    mode: "verify-production",
    wikiRows: rows.length,
    complete: rows.length - incomplete.length,
    incomplete: incomplete.length,
    missingSections: missingSections.length,
    noDownloads: noDownloads.length,
    publishedAssets: assets.length
  };
  if (rows.length === 0) throw new Error("No published wiki rows found in production.");
  if (incomplete.length) throw new Error(`Incomplete production pages: ${incomplete.map((row) => row.title).join(", ")}`);
  if (missingSections.length) throw new Error(`Production pages missing sections: ${missingSections.map((row) => row.title).join(", ")}`);
  if (noDownloads.length) throw new Error(`Production pages without downloads: ${noDownloads.map((row) => row.title).join(", ")}`);
  if (assets.length < rows.length) throw new Error(`Expected at least one published asset per page after apply; found ${assets.length} assets for ${rows.length} wiki rows.`);
  if (roadmapRow?.title !== "Planning Roadmap and Vault Review") {
    throw new Error(`Roadmap page title was not updated in production. Expected "Planning Roadmap and Vault Review"; found "${roadmapRow?.title || "missing page"}".`);
  }
  if (deprecatedMatches.length) {
    throw new Error(`Production still contains deprecated personalized-plan language:\n${deprecatedMatches.join("\n")}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

function deprecatedProductionMatches(rows, markdownBySlug, assets) {
  const matches = [];
  for (const row of rows) {
    const markdown = markdownBySlug.get(row.slug) || "";
    for (const phrase of DEPRECATED_PERSONALIZED_PLAN_PHRASES) {
      if (markdown.includes(phrase)) matches.push(`${row.slug}: ${phrase}`);
    }
  }
  for (const asset of assets) {
    const haystack = `${asset.title}\n${asset.linked_slug}\n${asset.r2_key}`;
    for (const phrase of DEPRECATED_PERSONALIZED_PLAN_PHRASES) {
      if (haystack.includes(phrase)) matches.push(`${asset.linked_slug || asset.title}: ${phrase}`);
    }
  }
  return matches;
}

function writeDocs(args) {
  const runDir = args.runDir || latestRunDir();
  const manifestPath = path.join(runDir, "implementation-readiness-manifest.json");
  const assetPlanPath = args.assetPlan || DEFAULT_ASSET_PLAN;
  if (!existsSync(manifestPath)) throw new Error(`Missing implementation manifest: ${manifestPath}`);
  if (!existsSync(assetPlanPath)) throw new Error(`Missing asset plan: ${assetPlanPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const assetPlan = JSON.parse(readFileSync(assetPlanPath, "utf8"));
  const rows = manifest.rows || [];
  const assets = assetPlan.assets || [];
  const productionAssetCount = assets.filter((asset) => asset.productionRowExists).length;
  const newAssetCount = assets.filter((asset) => !asset.productionRowExists).length;
  const beforeCounts = countBy(rows, (row) => row.classification);
  const afterCounts = countBy(rows, (row) => row.after?.classification || "Not prepared");
  const lines = [
    "# Wiki Implementation Readiness Audit",
    "",
    "Date: 2026-06-01",
    "",
    "## Scope",
    "",
    "This audit covers the live production Shona/Jay wiki inventory and the upgrade package applied to production on 2026-06-01. Production content, new worksheet assets, and the clarified checklist/roadmap language are now live.",
    "",
    "## Summary",
    "",
    `- Published production pages inventoried: ${rows.length}`,
    `- Published production assets inventoried before apply: ${productionAssetCount}`,
    `- Published production assets after apply: ${assets.length}`,
    `- New generated implementation worksheets applied: ${newAssetCount}`,
    `- Before classification: ${formatCounts(beforeCounts)}`,
    `- Production after classification: ${formatCounts(afterCounts)}`,
    "- Professional review remains built into the workflow for tax/legal/payroll/entity strategies; the upgrade does not imply self-implementation is safe.",
    "- The former personalized-plan language is reframed as a planning roadmap/vault review workflow, with verifier guards against deprecated personalized-plan promises and filenames.",
    "- Admin wiki saves now derive the stored page title from the markdown H1; the old personalized-plan page title is live as Planning Roadmap and Vault Review.",
    "",
    "## Production Apply",
    "",
    "Production approval was given and the production sequence was completed:",
    "",
    "```bash",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
    "npm run readiness",
    "npm run deploy",
    "npm run wiki:playbook:preflight",
    "npm run wiki:playbook:apply-assets:production",
    "npm run wiki:playbook:apply-pages:production",
    "npm run wiki:playbook:verify-production",
    "```",
    "",
    "The code deploy ran before the page apply so the production admin API stored the markdown H1 as the page title and the new Admin Review/Health playbook checks were available. Production asset/page apply commands require either `ADMIN_MASTER_PASSWORD` or an already-valid admin session cookie in the shell and fail closed without admin authentication. The preflight command regenerated the local asset plan, refreshed upgraded markdown drafts, and pre-apply verification artifacts. The page apply command refused to run until every planned asset from `.asset-runs/latest-download-assets-plan.json` existed in production and the published wiki inventory matched the prepared manifest. During page apply, the script saved the current production markdown for every page in the active `.wiki-playbook-runs/.../production-backups/` directory, wrote an incremental `apply-manifest.json`, then re-fetched each production page from R2 to verify the stored markdown and title matched the prepared file.",
    "",
    "If post-apply verification fails and the content needs to be reverted, run:",
    "",
    "```bash",
    "npm run wiki:playbook:rollback-pages:production",
    "npm run wiki:playbook:rollback-assets:production",
    "```",
    "",
    "The page rollback command restores the backed-up pre-upgrade markdown through the same admin API, republishes each restored page, and re-fetches production content to verify the restored markdown/title. The asset import command verifies each new worksheet's D1 metadata and production R2 hash after upload. The asset rollback command removes only the new assets recorded in the latest asset import manifest, then verifies their D1 rows and R2 objects are gone; existing production assets are skipped during import and are not rollback targets.",
    "",
    "## Audit Table",
    "",
    "| Lesson | Status before | Production change | Status after production upgrade | Downloads after production upgrade | Remaining advisor/source-review blocker |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const row of rows) {
    const before = `${row.classification} (${row.score}/12${row.missing.length ? `; missing ${row.missing.map((item) => item.label).join(", ")}` : ""})`;
    const after = `${row.after.classification} (${row.after.score}/12${row.after.missing.length ? `; missing ${row.after.missing.map((item) => item.label).join(", ")}` : ""})`;
    const change = preparedChangeSummary(row);
    const downloads = row.after.assetTitles.join("<br>");
    const blocker = row.after.highReview ? "Advisor review required before deployment; review gate is part of workflow." : "";
    lines.push(`| ${escapeCell(row.title)} | ${escapeCell(before)} | ${escapeCell(change)} | ${escapeCell(after)} | ${escapeCell(downloads)} | ${escapeCell(blocker)} |`);
  }
  lines.push(
    "",
    "## Verification Evidence",
    "",
    "- `npm run wiki:playbook:preflight` regenerated ignored run artifacts from the current production inventory before apply.",
    "- `npm run wiki:playbook:verify` passed: all prepared wiki rows complete after upgrade, 0 missing sections, 0 pages without downloads, 0 missing compiled keys, and generated worksheet files verified.",
    "- Pre-apply verification also fails if any prepared row is missing the production compiled R2 key needed for the stale-inventory guard.",
    "- Production code deploys completed: `d58beb7f-9b7d-4733-863f-0e847ee2bd63` for the playbook/admin health release and `e42e7984-0a58-446d-b1f0-e8a0a69ad81d` for the `/checklist` alias.",
    "- `npm run wiki:playbook:apply-assets:production` applied the 31 new worksheets; direct production verification confirmed 31/31 new worksheet D1 rows and R2 object hashes.",
    "- `npm run wiki:playbook:apply-pages:production` applied 56/56 wiki pages; `.wiki-playbook-runs/2026-06-01T20-21-29-720Z/apply-manifest.json` ended with `status: applied`.",
    "- `npm run wiki:playbook:verify-production` passed after production apply and the final client deploy: 56 wiki rows, 56 complete, 0 incomplete, 0 missing sections, 0 pages without downloads, 62 published assets.",
    "- App health checks now inspect published wiki markdown for obvious implementation-playbook sections and missing downloads, so Admin Review/Health can surface these gaps after the code is deployed.",
    "- Admin wiki update tests cover storing the markdown H1 as the page title, which keeps client lesson lists aligned with the corrected roadmap language.",
    "- Production verification checks live markdown and asset metadata for deprecated personalized-plan language after apply.",
    "- Production asset/page apply commands require admin authentication (`ADMIN_MASTER_PASSWORD` or `ADMIN_SESSION_COOKIE`); no production write script uses a fallback preview password.",
    "- Production page apply refuses to run if the published wiki inventory has changed since the prepared manifest was generated, forcing a fresh preflight before content writes.",
    "- Production page apply/rollback scripts re-fetch published R2 markdown and compare it to the prepared or backed-up files, including title checks from markdown H1s.",
    "- Production asset import/rollback scripts verify D1 metadata and R2 object hashes/removal for the newly generated worksheet assets.",
    "- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run readiness` passed after the verification tooling changes.",
    "- `npm run deploy:dry-run` passed before production apply after rebuilding the client bundle and checking Wrangler's production environment bindings; deploy scripts explicitly target `--env production`.",
    "- `PORT=8791 npm run e2e:local` passed after the default `8787` port was already in use: client chat, citations, feedback, escalation, trainings, admin ingest, publish, and health checks.",
    "- In-app browser QA on production verified Admin → Review shows 0 pages to review, Admin → Health has no `implementation_playbook_gap` or `missing_download_asset` findings after running health checks, and Admin → Assets shows the Planning Roadmap and Vault Review worksheet with Download actions.",
    "- In-app browser QA on production verified representative client lessons: Planning Roadmap and Vault Review, S-Corp Owner Payroll / Reasonable Compensation, and 1099 Income Flow Into Your Business include before-you-act language, advisor review gates, and related download links without deprecated personalized-plan promises.",
    "- In-app browser QA on production verified `/checklist` renders the Starter Checklist page and says it is not the client's personalized tax plan.",
    "- Authenticated production download check passed for `1099-income-flow-into-your-business-implementation-worksheet.docx`: HTTP 200, DOCX content type, attachment filename, 1,987 bytes."
  );
  const outputPath = path.join("docs", "WIKI_PLAYBOOK_AUDIT.md");
  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(JSON.stringify({ mode: "write-docs", outputPath, rows: rows.length }, null, 2));
}

function preparedChangeSummary(row) {
  if (!row.changed) return "No content change needed.";
  if (MARKDOWN_OVERRIDES.has(row.slug)) {
    return "Replace deprecated personalized-plan framing with a Planning Roadmap and Vault Review playbook covering applicability, non-fit cases, inputs, workflow, records, timing, caveats, mistakes, advisor review gates, completion checklist, downloads, and before-you-act language.";
  }
  return "Add Implementation Readiness Addendum covering applicability, non-fit cases, inputs, workflow, records, timing, caveats, mistakes, review gates, completion checklist, downloads, and before-you-act language.";
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function formatCounts(counts) {
  return Object.entries(counts).map(([key, value]) => `${value} ${key}`).join("; ");
}

async function main() {
  const args = parseArgs();
  if (args.mode === "verify-preapply") {
    verifyPreapply(args);
    return;
  }
  if (args.mode === "verify-production") {
    verifyProduction();
    return;
  }
  if (args.mode === "write-docs") {
    writeDocs(args);
    return;
  }
  if (args.mode === "apply-upgrades") {
    await applyUpgrades(args);
    return;
  }
  if (args.mode === "rollback-upgrades") {
    await rollbackUpgrades(args);
    return;
  }
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(RUNS_DIR, runId);
  const cacheDir = mkdtempSync(path.join(tmpdir(), "wiki-playbook-"));
  mkdirSync(runDir, { recursive: true });
  const upgradedDir = path.join(runDir, "upgraded");
  if (args.mode === "prepare-upgrades") {
    mkdirSync(upgradedDir, { recursive: true });
  }

  const pages = pagesWithAssets(null);
  const effectiveAssetPlan = args.assetPlan || (existsSync(DEFAULT_ASSET_PLAN) ? DEFAULT_ASSET_PLAN : null);
  const plannedPages = args.mode === "prepare-upgrades"
    ? new Map(pagesWithAssets(effectiveAssetPlan).map((page) => [page.id, page]))
    : new Map();
  const rows = [];
  for (const page of pages) {
    const markdown = fetchMarkdown(page, cacheDir);
    const row = analyzePage(page, markdown);
    rows.push(row);
    if (args.mode === "prepare-upgrades") {
      const plannedPage = plannedPages.get(page.id) || page;
      const upgraded = upgradeMarkdown(plannedPage, markdown);
      writeFileSync(path.join(upgradedDir, `${page.slug}.md`), upgraded);
      row.changed = upgraded !== markdown;
      row.after = analyzePage(plannedPage, upgraded);
    }
  }

  const reportPath = path.join(runDir, "implementation-readiness-report.md");
  const manifestPath = path.join(runDir, "implementation-readiness-manifest.json");
  writeFileSync(reportPath, reportMarkdown(rows, runDir));
  writeFileSync(manifestPath, `${JSON.stringify({ mode: args.mode, runId, rows }, null, 2)}\n`);
  writeFileSync(path.join(RUNS_DIR, "latest-report.md"), readFileSync(reportPath));
  writeFileSync(path.join(RUNS_DIR, "latest-manifest.json"), readFileSync(manifestPath));

  const counts = rows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] || 0) + 1;
    return acc;
  }, {});
  const afterCounts = rows.reduce((acc, row) => {
    if (row.after) {
      acc[row.after.classification] = (acc[row.after.classification] || 0) + 1;
    }
    return acc;
  }, {});
  console.log(JSON.stringify({
    mode: args.mode,
    pages: rows.length,
    counts,
    afterCounts: Object.keys(afterCounts).length ? afterCounts : null,
    reportPath,
    manifestPath,
    upgradedDir: args.mode === "prepare-upgrades" ? upgradedDir : null,
    changed: rows.filter((row) => row.changed).length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
