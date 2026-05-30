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
const adminPassword = process.env.ADMIN_PREVIEW_PASSWORD || "BEYOND";
const database = process.env.D1_DATABASE || "ask-shona-jay-db-production";
const bucket = process.env.R2_BUCKET || "ask-shona-jay-content-production";
const updatedTrainings = join(root, "Updated Trainings");
const runsDir = join(root, ".asset-runs");
const latestManifest = join(runsDir, "latest-download-assets-manifest.json");
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
  generatedDocx("Worker Classification Checklist", "Fact checklist before paying a worker as contractor or employee.", "worker-classification-intake-checklist", "worker-classification-intake-checklist", "Worker-Classification-Checklist.docx", [
    ["Worker facts", ["Worker name", "Services provided", "Start date", "Expected duration"]],
    ["Behavioral control", ["Who directs the work", "Required hours", "Training provided", "Tools and methods controlled"]],
    ["Financial control", ["Who provides tools", "Opportunity for profit or loss", "Flat fee or hourly", "Invoices and business entity details"]],
    ["Relationship", ["Written agreement", "Benefits", "Ongoing or project-based work", "Before payment, ask the team to review close calls"]]
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
  const missing = planned.filter((item) => !existsSync(item.filePath));
  const slugs = await loadPublishedSlugs();
  const missingSlugs = planned.filter((item) => !slugs.has(item.linkedSlug));
  const existingRows = await loadExistingRows();
  console.log(`Mode: ${mode}`);
  console.log(`Planned assets: ${planned.length}`);
  for (const item of planned) {
    const status = existsSync(item.filePath) ? "ok" : "missing-file";
    const page = slugs.has(item.linkedSlug) ? item.linkedSlug : "missing-page";
    const exists = existingRows.has(item.r2Key) ? "existing-row" : "new-row";
    console.log(`- ${item.title} | ${item.mimeType} | ${page} | ${status} | ${exists}`);
  }
  if (missing.length) {
    throw new Error(`Missing local files:\n${missing.map((item) => `- ${item.filePath}`).join("\n")}`);
  }
  if (missingSlugs.length) {
    throw new Error(`Missing published Learn pages:\n${missingSlugs.map((item) => `- ${item.linkedSlug} (${item.title})`).join("\n")}`);
  }
  if (mode === "dry-run") {
    console.log("Dry run complete. No R2 or D1 changes were made.");
    return;
  }
  await assertAdminAccess();
  const manifest = { runId, tenantId, createdAt: new Date().toISOString(), assets: [] };
  for (const item of planned) {
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
  writeFileSync(join(runDir, "download-assets-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(latestManifest, JSON.stringify(manifest, null, 2));
  console.log(`Imported ${manifest.assets.length} assets. Manifest: ${latestManifest}`);
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
  const health = await fetch(`${origin}/api/health`);
  if (!health.ok) throw new Error(`Production health failed: ${health.status}`);
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
  console.log(`Rolled back ${(manifest.assets || []).length} assets from ${latestManifest}`);
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
