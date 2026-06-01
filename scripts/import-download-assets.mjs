#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--rollback") ? "rollback" : "dry-run";
const root = process.cwd();
const tenantId = "tenant_beyond_freedom";
const origin = process.env.APP_ORIGIN || "https://ask.beyondfreedomfinancial.com";
const adminPassword = process.env.ADMIN_MASTER_PASSWORD;
const adminSessionCookie = process.env.ADMIN_SESSION_COOKIE;
const database = process.env.D1_DATABASE || "ask-shona-jay-db-production";
const bucket = process.env.R2_BUCKET || "ask-shona-jay-content-production";
const updatedTrainings = join(root, "Updated Trainings");
const runsDir = join(root, ".asset-runs");
const latestManifest = join(runsDir, "latest-download-assets-manifest.json");
const latestPlan = join(runsDir, "latest-download-assets-plan.json");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(runsDir, runId);
const generatedDir = join(runDir, "generated-assets");

const existingAssets = [
  asset("Augusta Rule Quick Reference Guide", "Reference guide for Augusta Rule documentation and guardrails.", "augusta-rule", "augusta-rule-14-day-rental", "Augusta Strategy/Quick-Reference-Guide-Augusta-Rule.pdf"),
  asset("Cost Segregation Resource Guide", "Training guide for cost segregation records and review points.", "cost-segregation", "cost-segregation", "Cost Seg Strategy/Cost-Segregation-Resource-Guide.pdf"),
  asset("Depreciation Resource Guide", "Training guide for depreciation planning and recordkeeping.", "depreciation", "depreciation-strategy", "Depreciation Strategy/The-Magic-of-Depreciation-Resource-Guide.pdf"),
  asset("Hiring Your Kids Quick Reference Guide", "Core reference guide for the hiring kids strategy.", "hire-kids", "hiring-your-kids", "Hiring Your Kids Strategy/Quick-Reference-Guide-Hiring-Your-Kids.pdf"),
  asset("Kids Payroll Job Description Prompts", "Editable prompt guide for drafting child job descriptions.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring Your Kids Strategy/Chat-GPT Prompt for Job Description.docx"),
  asset("Sample Kids Job Descriptions", "Editable examples for child payroll roles.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring Your Kids Strategy/Job Descriptions for Kids on Payroll.docx"),
  asset("Sample Employee Time Sheet", "Spreadsheet time sheet for child payroll documentation.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring Your Kids Strategy/Sample Employee Time Sheet.xlsx"),
  asset("Simple Management Agreement Template", "Editable agreement template used with child payroll administration.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring Your Kids Strategy/Simple Management Agreement - Template.docx"),
  asset("Home Office Quick Reference Guide", "Reference guide for home office reimbursement support.", "home-office", "home-office-reimbursement", "Home Office Strategy/Quick-Reference-Guide-Home-Office.pdf"),
  asset("Meals Quick Reference Guide", "Reference guide for documenting meals with business purpose.", "meals", "meals-deduction", "Meals Strategy/Quick-Reference-Guide-Meals.pdf"),
  asset("Medical Reimbursement Quick Reference Guide", "Reference guide for medical and health reimbursement review.", "medical-reimbursement", "medical-health-reimbursement-strategy", "Medical Strategy/Quick-Reference-Guide-MERP.pdf"),
  asset("Real Estate Professional Status Resource Guide", "Resource guide for real estate professional facts and documentation.", "real-estate-professional", "real-estate-professional-qualification", "Real Estate Pro Strategy/Resource-Guide-Real-Estate-Professional-Status.pdf"),
  asset("LLC to S-Corp Quick Reference Guide", "Reference guide for LLC to S-corp conversion review.", "llc-to-s-corp", "llc-to-s-corp-conversion", "S-Corp Strategy/Quick-Reference-Guide-LLC-to-S-Corp-.pdf"),
  asset("Late S Election Quick Reference Guide", "Reference guide for late S-corp election review.", "late-s-corp-election", "late-s-corp-election", "S-Corp Strategy/Quick-Reference-Guide-Late-S-Election.pdf"),
  asset("Short-Term Rental Strategy Guide", "Guide for short-term rental planning, records, and review points.", "short-term-rental", "short-term-rental-strategy", "Short Term Rental Strategy/Short-Term-Rental-STR-Strategy-Guide-for-Business-Owners.pdf"),
  asset("Entity Diagram", "Editable entity diagram for asset protection conversations.", "entity-protection", "power-of-entities-and-asset-protection", "The Power of Entities/Asset Protection - Entity Diagram.docx"),
  asset("Power of Entities Quick Reference Guide", "Reference guide for entity and asset protection planning.", "entity-protection", "power-of-entities-and-asset-protection", "The Power of Entities/Quick-Reference-Guide-The-Power-of-Entities.pdf"),
  asset("Travel Quick Reference Guide", "Reference guide for business travel documentation.", "travel", "business-travel-deduction", "Travel Strategy/Quick-Reference-Guide-Travel.pdf"),
  asset("Vehicle Quick Reference Guide", "Reference guide for vehicle mileage and actual expense support.", "vehicle-mileage", "vehicle-deduction", "Vehicle Strategy/Quick-Reference-Guide-Vehicle-2024-2025.pdf")
];

const generatedAssets = [
  generatedDocx("Augusta Rule Meeting Packet", "Agenda, minutes, invoice, and rate-support worksheet for a documented business meeting.", "augusta-rule-meeting-packet", "augusta-rule-meeting-packet", "Augusta-Rule-Meeting-Packet.docx", [
    ["Meeting setup", ["Meeting date and location", "Business purpose", "Attendees and roles", "Agenda items tied to business decisions"]],
    ["Minutes", ["Start and end time", "Decisions made", "Action items and owners", "Follow-up dates"]],
    ["Invoice support", ["Rental date", "Fair rental value support", "Amount paid", "Payment method and date"]],
    ["Before you act", ["Confirm this is a real business meeting", "Keep comparable rate support", "Ask the team to review facts before filing"]]
  ]),
  generatedDocx("Hiring Kids Job Description Template", "Editable role description for legitimate child payroll work.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring-Kids-Job-Description-Template.docx", [
    ["Role basics", ["Child name", "Job title", "Department or business function", "Supervisor"]],
    ["Duties", ["List recurring duties", "Describe expected output", "Tie duties to real business needs"]],
    ["Pay support", ["Proposed hourly rate", "How rate was determined", "Expected hours", "Payroll start date"]],
    ["Review points", ["Confirm age-appropriate duties", "Confirm payroll and labor rules", "Keep time sheets before payment"]]
  ]),
  generatedXlsx("Hiring Kids Timesheet", "Weekly time sheet for child payroll records.", "hire-kids-implementation-kit", "hiring-kids-implementation-kit", "Hiring-Kids-Timesheet.xlsx", ["Date", "Task", "Start", "End", "Hours", "Supervisor Review"]),
  generatedXlsx("Vehicle Mileage Log", "Mileage log for business vehicle use.", "vehicle-mileage-actual-expense-kit", "vehicle-mileage-and-actual-expense-kit", "Vehicle-Mileage-Log.xlsx", ["Date", "Starting Location", "Destination", "Business Purpose", "Odometer Start", "Odometer End", "Business Miles", "Notes"]),
  generatedDocx("Business Travel Trip Memo", "Trip memo for business purpose, itinerary, and personal-use allocation.", "business-travel-trip-memo-kit", "business-travel-trip-memo-kit", "Business-Travel-Trip-Memo.docx", [
    ["Trip facts", ["Dates", "Destination", "Primary business purpose", "Business attendees"]],
    ["Business schedule", ["Meetings", "Site visits", "Conference sessions", "Work blocks"]],
    ["Expense support", ["Transportation", "Lodging", "Meals", "Personal or family portions to separate"]],
    ["Before you act", ["Save receipts and itinerary", "Separate business and personal days", "Ask the team to review mixed-purpose travel"]]
  ]),
  generatedXlsx("Accountable Plan Reimbursement Form", "Monthly reimbursement form for accountable plan expenses.", "accountable-plan-monthly-kit", "accountable-plan-monthly-reimbursement-kit", "Accountable-Plan-Reimbursement-Form.xlsx", ["Date", "Expense Category", "Business Purpose", "Amount", "Receipt Attached", "Submitted Date", "Reimbursed Date", "Excess Returned"]),
  generatedXlsx("Year-End Closeout Checklist", "Checklist for gathering books, payroll, deduction, and entity records before year-end review.", "year-end-closeout-kit", "year-end-strategy-closeout-kit", "Year-End-Closeout-Checklist.xlsx", ["Area", "Item", "Owner", "Due Date", "Status", "Notes"]),
  generatedDocx("IRS Notice Response Packet", "Packet for gathering notice pages, transcript details, payment proof, deadlines, and advisor questions.", "irs-notice-response-packet", "irs-notice-response-packet", "IRS-Notice-Response-Packet.docx", [
    ["Notice facts", ["Notice number", "Tax year or period", "Date on notice", "Response deadline"]],
    ["Documents to attach", ["All notice pages", "IRS transcript or account screenshot", "Payment proof", "Prior correspondence"]],
    ["Client notes", ["What you believe changed", "Payments already made", "Deadlines or calls already scheduled", "Questions for Shona/Jay"]],
    ["Before you act", ["Do not ignore the deadline", "Do not send a response without team review", "Keep copies of anything mailed or uploaded"]]
  ]),
  generatedXlsx("Estimated Tax 30-Day Review Worksheet", "Worksheet for gathering profit, withholding, distributions, and changes before a quarterly estimate review.", "estimated-tax-30-day-kit", "estimated-tax-30-day-review-kit", "Estimated-Tax-30-Day-Review-Worksheet.xlsx", ["Area", "Current Amount", "Prior Quarter Amount", "Changed Since Last Review", "Support Attached", "Question for Team"]),
  generatedDocx("Real Estate Strategy Intake Packet", "Intake packet for cost segregation, short-term rental, and real estate professional review facts.", "real-estate-strategy-intake-packet", "cost-seg-str-real-estate-professional-intake-packet", "Real-Estate-Strategy-Intake-Packet.docx", [
    ["Property facts", ["Property address", "Placed-in-service date", "Purchase price and allocation", "Short-term rental days"]],
    ["Activity support", ["Owner hours by activity", "Management logs", "Guest/rental records", "Material participation notes"]],
    ["Depreciation support", ["Closing statement", "Prior depreciation schedule", "Cost segregation report if available", "Improvement invoices"]],
    ["Before you act", ["Confirm current-year limits", "Ask the team to review loss, basis, and participation facts", "Coordinate with state and filing-position review"]]
  ]),
  generatedXlsx("Home Office Monthly Reimbursement Worksheet", "Monthly worksheet for home office expense support and reimbursement review.", "home-office-reimbursement-worksheet", "home-office-monthly-reimbursement-worksheet", "Home-Office-Monthly-Reimbursement-Worksheet.xlsx", ["Month", "Business Square Feet", "Total Square Feet", "Expense Category", "Total Expense", "Business Portion", "Receipt Attached", "Notes"]),
  generatedDocx("Worker Classification Checklist", "Fact checklist before paying a worker as contractor or employee.", "worker-classification-intake-checklist", "worker-classification-intake-checklist", "Worker-Classification-Checklist.docx", [
    ["Worker facts", ["Worker name", "Services provided", "Start date", "Expected duration"]],
    ["Behavioral control", ["Who directs the work", "Required hours", "Training provided", "Tools and methods controlled"]],
    ["Financial control", ["Who provides tools", "Opportunity for profit or loss", "Flat fee or hourly", "Invoices and business entity details"]],
    ["Relationship", ["Written agreement", "Benefits", "Ongoing or project-based work", "Before payment, ask the team to review close calls"]]
  ]),
  ...playbookWorksheets([
    ["1099 Income Flow Into Your Business", "1099-business-flow", "1099-income-flow-into-your-business"],
    ["Accountable Plan Reimbursements", "accountable-plan-system", "accountable-plan-reimbursements"],
    ["Audit Defense Documentation", "audit-defense-documentation", "audit-defense-documentation"],
    ["Augusta Rule Meeting Calendar and Rate Planning", "augusta-calendar-rate-planning", "augusta-rule-meeting-calendar-and-rate-planning"],
    ["Augusta Rule Payment Cadence", "augusta-payment-cadence", "augusta-rule-payment-cadence"],
    ["Basis Tracking for Real Estate, Inheritance, and Entity Owners", "basis-tracking-system", "basis-tracking-for-real-estate-inheritance-and-entity-owners"],
    ["Business Intention Framework", "business-intention", "business-intention-framework"],
    ["Business Losses, At-Risk Limits, Passive Losses, and NOLs", "business-loss-limits", "business-losses-at-risk-limits-passive-losses-and-nols"],
    ["Business Owner Tax Mindset", "business-owner-tax-mindset", "business-owner-tax-mindset"],
    ["Estimated Tax Payment System", "estimated-tax-system", "estimated-tax-payment-system"],
    ["HSA / Medical Deduction Decision Tree", "hsa-medical-decision-tree", "hsa-medical-deduction-decision-tree"],
    ["Health Insurance Before Medicare", "health-insurance-before-medicare", "health-insurance-before-medicare"],
    ["Home Office Monthly Reimbursement Cadence", "home-office-monthly-cadence", "home-office-monthly-reimbursement-cadence"],
    ["IRS Account, Transcript, Notice, and Refund Workflow", "irs-account-notice-workflow", "irs-account-transcript-notice-and-refund-workflow"],
    ["Inheritance, Basis, and Future Tax Planning", "inheritance-basis-planning", "inheritance-basis-and-future-tax-planning"],
    ["Medical Expense Deduction Paths", "medical-expense-paths", "medical-expense-deduction-paths"],
    ["Ministerial Housing Allowance Review", "ministerial-housing-allowance", "ministerial-housing-allowance-review"],
    ["Missing Refunds and IRS Account Review", "missing-refunds-irs-account", "missing-refunds-and-irs-account-review"],
    ["Mixed-Purpose Travel Decision Framework", "mixed-purpose-travel", "mixed-purpose-travel-decision-framework"],
    ["Planning Roadmap and Vault Review", "tax-plan-vault-roadmap", "personalized-tax-plan-and-vault-roadmap", "planning-roadmap-and-vault-review"],
    ["QBI Deduction Basics and 2026 Watchpoint", "qbi-deduction-review", "qbi-deduction-basics-and-2026-watchpoint"],
    ["Receipt Management and Monthly Books", "receipt-management", "receipt-management-and-monthly-books"],
    ["Retirement Withdrawal Tax Buckets", "retirement-tax-buckets", "retirement-withdrawal-tax-buckets"],
    ["Roth Conversion and Backdoor Roth Review", "roth-conversion-review", "roth-conversion-and-backdoor-roth-review"],
    ["S-Corp Owner Payroll / Reasonable Compensation", "s-corp-reasonable-compensation", "s-corp-owner-payroll-reasonable-compensation"],
    ["Schedule C to Entity Transition", "schedule-c-to-entity", "schedule-c-to-entity-transition"],
    ["Social Security and Retirement Income Tax Planning", "social-security-retirement-tax-planning", "social-security-and-retirement-income-tax-planning"],
    ["Tax Document Intake and Strategy Roadmap", "tax-intake-roadmap", "tax-document-intake-and-strategy-roadmap"],
    ["Tax Vault File Structure", "tax-vault-file-structure", "tax-vault-file-structure"],
    ["Worker Classification", "worker-classification-review", "worker-classification"],
    ["Year-End Strategy Review Checklist", "year-end-strategy-review", "year-end-strategy-review-checklist"]
  ])
];

await main();

async function main() {
  mkdirSync(runsDir, { recursive: true });
  if (mode === "rollback") {
    rollback();
    return;
  }
  mkdirSync(generatedDir, { recursive: true });
  const planned = [...existingAssets, ...buildGeneratedAssets()];
  const slugs = await loadPublishedSlugs();
  const missingSlugs = planned.filter((item) => !slugs.has(item.linkedSlug));
  const existingRows = await loadExistingRows();
  const uploadable = planned.filter((item) => existsSync(item.filePath) && !existingRows.has(item.r2Key));
  const existingWithLocal = planned.filter((item) => existsSync(item.filePath) && existingRows.has(item.r2Key));
  const missingNew = planned.filter((item) => !existsSync(item.filePath) && !existingRows.has(item.r2Key));
  const skippedExisting = planned.filter((item) => !existsSync(item.filePath) && existingRows.has(item.r2Key));
  console.log(`Mode: ${mode}`);
  console.log(`Planned assets: ${planned.length}`);
  for (const item of planned) {
    const status = existsSync(item.filePath) ? "ok" : "missing-file";
    const page = slugs.has(item.linkedSlug) ? item.linkedSlug : "missing-page";
    const exists = existingRows.has(item.r2Key) ? "existing-row" : "new-row";
    console.log(`- ${item.title} | ${item.mimeType} | ${page} | ${status} | ${exists}`);
  }
  if (skippedExisting.length) {
    console.log(`Skipping ${skippedExisting.length} existing production asset(s) with missing local source files.`);
  }
  if (existingWithLocal.length) {
    console.log(`Skipping ${existingWithLocal.length} existing production asset(s) with local generated/source files.`);
  }
  if (missingNew.length) {
    throw new Error(`Missing local files for new assets:\n${missingNew.map((item) => `- ${item.filePath}`).join("\n")}`);
  }
  if (missingSlugs.length) {
    throw new Error(`Missing published Learn pages:\n${missingSlugs.map((item) => `- ${item.linkedSlug} (${item.title})`).join("\n")}`);
  }
  writePlan(planned, existingRows);
  if (mode === "dry-run") {
    console.log("Dry run complete. No R2 or D1 changes were made.");
    return;
  }
  await assertAdminAccess();
  const manifest = { runId, tenantId, createdAt: new Date().toISOString(), assets: [] };
  for (const item of uploadable) {
    putR2(item);
    upsertAsset(item);
    manifest.assets.push({
      id: item.id,
      title: item.title,
      r2Key: item.r2Key,
      linkedSlug: item.linkedSlug,
      strategyKey: item.strategyKey,
      sourcePath: item.filePath,
      sha256: hashFile(item.filePath)
    });
  }
  manifest.verified = verifyImportedAssets(manifest.assets);
  writeFileSync(join(runDir, "download-assets-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(latestManifest, JSON.stringify(manifest, null, 2));
  console.log(`Imported ${manifest.assets.length} new assets. Manifest: ${latestManifest}`);
}

function writePlan(planned, existingRows) {
  const plan = {
    runId,
    tenantId,
    createdAt: new Date().toISOString(),
    mode,
    assets: planned.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      filename: item.filename,
      mimeType: item.mimeType,
      strategyKey: item.strategyKey,
      linkedSlug: item.linkedSlug,
      r2Key: item.r2Key,
      localFileExists: existsSync(item.filePath),
      productionRowExists: existingRows.has(item.r2Key)
    }))
  };
  writeFileSync(join(runDir, "download-assets-plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(latestPlan, JSON.stringify(plan, null, 2));
}

function asset(title, description, strategyKey, linkedSlug, relativePath) {
  const filePath = join(updatedTrainings, relativePath);
  const filename = basename(filePath);
  return defineAsset({ title, description, strategyKey, linkedSlug, filename, filePath });
}

function generatedDocx(title, description, strategyKey, linkedSlug, filename, sections) {
  return { kind: "docx", title, description, strategyKey, linkedSlug, filename, sections };
}

function generatedXlsx(title, description, strategyKey, linkedSlug, filename, headers) {
  return { kind: "xlsx", title, description, strategyKey, linkedSlug, filename, headers };
}

function playbookWorksheets(items) {
  return items.map(([title, strategyKey, linkedSlug, filenameSlug = linkedSlug]) => generatedDocx(
    `${title} Implementation Worksheet`,
    "Client fact-gathering worksheet and advisor review checklist for the related wiki lesson.",
    strategyKey,
    linkedSlug,
    `${filenameSlug}-implementation-worksheet.docx`,
    [
      ["Client facts", ["Client name", "Tax year", "Entity type and state", "Strategy goal or question", "Dollar amounts, dates, accounts, people, or properties involved"]],
      ["Records to attach", ["Documents listed in the related wiki lesson", "Receipts, statements, agreements, notices, logs, forms, or screenshots that support the facts", "Notes explaining any missing or uncertain records"]],
      ["Implementation notes", ["Best-fit and not-a-fit bullets reviewed", "Current-year federal, state, payroll, entity, or filing caveats identified", "Open decisions or unclear facts listed for Shona/Jay"]],
      ["Advisor review gate", ["Do not file, elect, reimburse, run payroll, move money, or claim a deduction from this worksheet alone", "Send the completed worksheet and attachments for Shona/Jay review", "Save the reviewed decision and final support in the tax vault"]]
    ]
  ));
}

function buildGeneratedAssets() {
  return generatedAssets.map((item) => {
    const filePath = join(generatedDir, item.filename);
    if (item.kind === "docx") writeDocx(filePath, item.title, item.sections);
    if (item.kind === "xlsx") writeXlsx(filePath, item.title, item.headers);
    return defineAsset({ ...item, filePath });
  });
}

function defineAsset(input) {
  const mimeType = mimeFor(input.filename);
  const r2Key = `assets/${tenantId}/${input.strategyKey}/${input.filename}`;
  return {
    id: `asset_${createHash("sha1").update(r2Key).digest("hex").slice(0, 20)}`,
    title: input.title,
    description: input.description,
    filename: input.filename,
    mimeType,
    filePath: input.filePath,
    strategyKey: input.strategyKey,
    linkedSlug: input.linkedSlug,
    r2Key
  };
}

async function assertAdminAccess() {
  if (!adminPassword && !adminSessionCookie) {
    throw new Error("ADMIN_MASTER_PASSWORD or ADMIN_SESSION_COOKIE is required for --apply.");
  }
  const health = await fetch(`${origin}/api/health`);
  if (!health.ok) throw new Error(`Production health failed: ${health.status}`);
  if (adminSessionCookie) {
    const dashboard = await fetch(`${origin}/api/admin/dashboard`, { headers: { Cookie: adminSessionCookie } });
    if (!dashboard.ok) throw new Error(`Admin dashboard preflight failed with ADMIN_SESSION_COOKIE: ${dashboard.status}`);
    return;
  }
  const auth = await fetch(`${origin}/api/auth/admin-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPassword })
  });
  if (!auth.ok) throw new Error(`Admin auth failed: ${auth.status}`);
  const cookie = auth.headers.get("set-cookie")?.split(";")[0];
  const dashboard = await fetch(`${origin}/api/admin/dashboard`, { headers: { Cookie: cookie || "" } });
  if (!dashboard.ok) throw new Error(`Admin dashboard preflight failed: ${dashboard.status}`);
}

async function loadPublishedSlugs() {
  const rows = d1Json("SELECT slug FROM wiki_pages WHERE tenant_id='tenant_beyond_freedom' AND status='published'");
  return new Set(rows.map((row) => row.slug));
}

async function loadExistingRows() {
  const rows = d1Json("SELECT r2_key FROM download_assets WHERE tenant_id='tenant_beyond_freedom'");
  return new Set(rows.map((row) => row.r2_key));
}

function d1Json(sql) {
  const output = wrangler(["d1", "execute", database, "--env", "production", "--remote", "--command", sql, "--json"]);
  const parsed = JSON.parse(output);
  return parsed[0]?.results || [];
}

function putR2(item) {
  wrangler(["r2", "object", "put", `${bucket}/${item.r2Key}`, "--file", item.filePath, "--remote"]);
}

function upsertAsset(item) {
  const now = new Date().toISOString();
  const sql = `INSERT INTO download_assets (
    id, tenant_id, title, description, filename, mime_type, r2_key, strategy_key,
    linked_slug, status, visibility_tier, sort_order, created_at, updated_at
  ) VALUES (
    ${q(item.id)}, ${q(tenantId)}, ${q(item.title)}, ${q(item.description)}, ${q(item.filename)}, ${q(item.mimeType)},
    ${q(item.r2Key)}, ${q(item.strategyKey)}, ${q(item.linkedSlug)}, 'published', 'all', 0, ${q(now)}, ${q(now)}
  )
  ON CONFLICT(tenant_id, r2_key) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    filename = excluded.filename,
    mime_type = excluded.mime_type,
    strategy_key = excluded.strategy_key,
    linked_slug = excluded.linked_slug,
    status = excluded.status,
    visibility_tier = excluded.visibility_tier,
    updated_at = excluded.updated_at;`;
  d1Json(sql);
}

function verifyImportedAssets(items) {
  const verified = [];
  for (const item of items) {
    const row = assetRowByKey(item.r2Key);
    if (!row) {
      throw new Error(`Imported asset is missing its production D1 row: ${item.title}`);
    }
    if (row.id !== item.id || row.title !== item.title || row.linked_slug !== item.linkedSlug || row.strategy_key !== item.strategyKey || row.status !== "published") {
      throw new Error(`Imported asset metadata mismatch for ${item.title}`);
    }
    const remoteHash = r2ObjectHash(item.r2Key);
    if (remoteHash !== item.sha256) {
      throw new Error(`Imported asset hash mismatch for ${item.title}: expected ${item.sha256}, found ${remoteHash}`);
    }
    verified.push({ id: item.id, title: item.title, r2Key: item.r2Key, sha256: remoteHash });
  }
  return verified;
}

function assetRowByKey(r2Key) {
  return d1Json(`
    SELECT id, title, linked_slug, strategy_key, status, r2_key
    FROM download_assets
    WHERE tenant_id=${q(tenantId)} AND r2_key=${q(r2Key)}
    LIMIT 1
  `)[0] || null;
}

function r2ObjectHash(r2Key) {
  const tempDir = makeTempDir("asset-verify");
  const filePath = join(tempDir, basename(r2Key));
  try {
    wrangler(["r2", "object", "get", `${bucket}/${r2Key}`, "--remote", "--file", filePath]);
    return hashFile(filePath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function rollback() {
  if (!existsSync(latestManifest)) throw new Error(`No manifest found at ${latestManifest}`);
  const manifest = JSON.parse(readFileSync(latestManifest, "utf8"));
  for (const item of manifest.assets || []) {
    try {
      wrangler(["r2", "object", "delete", `${bucket}/${item.r2Key}`, "--remote"]);
    } catch (error) {
      console.warn(`R2 delete warning for ${item.r2Key}: ${error.message}`);
    }
  }
  const ids = (manifest.assets || []).map((item) => q(item.id)).join(", ");
  if (ids) {
    d1Json(`DELETE FROM download_assets WHERE tenant_id='${tenantId}' AND id IN (${ids})`);
  }
  verifyRolledBackAssets(manifest.assets || []);
  console.log(`Rolled back ${(manifest.assets || []).length} assets from ${latestManifest}`);
}

function verifyRolledBackAssets(items) {
  for (const item of items) {
    const row = assetRowByKey(item.r2Key);
    if (row) {
      throw new Error(`Rolled-back asset still has a production D1 row: ${item.title}`);
    }
    if (r2ObjectExists(item.r2Key)) {
      throw new Error(`Rolled-back asset still exists in production R2: ${item.title}`);
    }
  }
}

function r2ObjectExists(r2Key) {
  const tempDir = makeTempDir("asset-rollback-verify");
  const filePath = join(tempDir, basename(r2Key));
  try {
    execFileSync("npx", ["wrangler", "r2", "object", "get", `${bucket}/${r2Key}`, "--remote", "--file", filePath], {
      cwd: root,
      env: process.env,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeDocx(filePath, title, sections) {
  const temp = makeTempDir("docx");
  mkdirSync(join(temp, "_rels"), { recursive: true });
  mkdirSync(join(temp, "word"), { recursive: true });
  writeFileSync(join(temp, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  writeFileSync(join(temp, "_rels/.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  const body = [
    paragraph(title, true),
    paragraph("Beyond Freedom Financial client worksheet. Complete the facts, attach support, and bring client-specific decisions to the team before acting."),
    ...sections.flatMap(([heading, bullets]) => [paragraph(heading, true), ...bullets.map((item) => paragraph(`□ ${item}`))])
  ].join("");
  writeFileSync(join(temp, "word/document.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  zipFolder(temp, filePath);
  rmSync(temp, { recursive: true, force: true });
}

function writeXlsx(filePath, title, headers) {
  const temp = makeTempDir("xlsx");
  mkdirSync(join(temp, "_rels"), { recursive: true });
  mkdirSync(join(temp, "xl/_rels"), { recursive: true });
  mkdirSync(join(temp, "xl/worksheets"), { recursive: true });
  writeFileSync(join(temp, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  writeFileSync(join(temp, "_rels/.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  writeFileSync(join(temp, "xl/workbook.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(title.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  writeFileSync(join(temp, "xl/_rels/workbook.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  const row = headers.map((value, index) => cell(index + 1, 1, value)).join("");
  const blanks = Array.from({ length: 20 }, (_, r) => `<row r="${r + 2}">${headers.map((_, c) => cell(c + 1, r + 2, "")).join("")}</row>`).join("");
  writeFileSync(join(temp, "xl/worksheets/sheet1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${row}</row>${blanks}</sheetData></worksheet>`);
  zipFolder(temp, filePath);
  rmSync(temp, { recursive: true, force: true });
}

function paragraph(text, bold = false) {
  const run = bold ? `<w:r><w:rPr><w:b/></w:rPr><w:t>${xml(text)}</w:t></w:r>` : `<w:r><w:t>${xml(text)}</w:t></w:r>`;
  return `<w:p>${run}</w:p>`;
}

function cell(column, row, value) {
  return `<c r="${columnName(column)}${row}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    index = Math.floor((index - mod) / 26);
  }
  return name;
}

function zipFolder(folder, output) {
  mkdirSync(dirname(output), { recursive: true });
  execFileSync("zip", ["-qr", output, "."], { cwd: folder });
}

function makeTempDir(prefix) {
  const dir = resolve(tmpdir(), `ask-shona-${prefix}-${createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 10)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function mimeFor(filename) {
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function xml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}
