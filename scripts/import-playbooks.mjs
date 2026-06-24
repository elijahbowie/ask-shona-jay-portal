#!/usr/bin/env node

/*
 * Import the regenerated implementation playbooks in content/playbooks/lessons/*.md
 * into the wiki as published pages, reusing the existing admin API
 * (createSource -> ingest -> PUT /api/admin/wiki/:id -> publish).
 *
 * Upsert by slug: an existing page (the production case, where all 56 titles
 * already exist) is updated in place and republished; a slug with no page is
 * created fresh. Matches the conventions of seed-preview-knowledge.mjs and
 * wiki-implementation-playbook-audit.mjs: dry-run/apply/validate/rollback,
 * admin-auth-gated writes, run manifest + per-page backups for reversal.
 *
 * Targets production by default. Override for a local portal with:
 *   PORTAL_ORIGIN=http://localhost:8787 TARGET_DB=ask-shona-jay-db \
 *   WRANGLER_ENV= WRANGLER_LOCAL=1 node scripts/import-playbooks.mjs --apply
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TENANT_ID = "tenant_beyond_freedom";
const LESSONS_DIR = "content/playbooks/lessons";
const RUNS_DIR = ".playbook-import-runs";
const HEADERS_JSON = { "content-type": "application/json" };

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN ?? "https://ask.beyondfreedomfinancial.com";
const TARGET_DB = process.env.TARGET_DB ?? "ask-shona-jay-db-production";
const TARGET_BUCKET = process.env.TARGET_BUCKET ?? "ask-shona-jay-content-production";
const WRANGLER_ENV = process.env.WRANGLER_ENV ?? "production";
const WRANGLER_REMOTE = process.env.WRANGLER_LOCAL ? "--local" : "--remote";

const ADMIN_AUTH_PATH = "/api/auth/admin-password";

// ── argument + small helpers (mirrors seed-preview-knowledge.mjs) ───────────
function parseArgs(argv) {
  const args = { mode: null, manifestPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--dry-run" || item === "--apply" || item === "--validate" || item === "--rollback") {
      args.mode = item.slice(2);
      continue;
    }
    if (item === "--manifest") {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.mode) {
    throw new Error("Choose one mode: --dry-run, --apply, --validate, or --rollback.");
  }
  return args;
}

const slugFor = (title) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sqlEscape = (value) => String(value).replaceAll("'", "''");
const quoted = (values) => values.map((value) => `'${sqlEscape(value)}'`).join(", ");
const contentHash = (text) => createHash("sha256").update(text).digest("hex");
const nowIso = () => new Date().toISOString();

function ensureRunDir() {
  const dir = path.join(RUNS_DIR, nowIso().replace(/[:.]/g, "-"));
  mkdirSync(path.join(dir, "backups"), { recursive: true });
  return dir;
}

function titleFromMarkdown(markdown) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : null;
}

function summarize(markdown) {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith(">") || line.startsWith("**") || line.startsWith("|")) continue;
    return line.slice(0, 280);
  }
  return "";
}

// Keep strategy_key aligned with the existing client-side category logic
// (insights.categoryFor matches on substrings of the key). The slug already
// carries the strategy noun, so it is a safe, stable key.
function strategyKeyFor(slug) {
  return slug;
}

// ── load + validate the playbook corpus ─────────────────────────────────────
function loadLessons() {
  if (!existsSync(LESSONS_DIR)) {
    throw new Error(`Missing ${LESSONS_DIR}. Generate the playbooks first.`);
  }
  const files = readdirSync(LESSONS_DIR).filter((f) => f.endsWith(".md")).sort();
  const required = [
    "## Who This Applies To",
    "## When This Is Not A Fit",
    "## Step-By-Step Implementation",
    "## Advisor Review Gates",
    "## Before You Act",
    "## Sources"
  ];
  const lessons = [];
  const problems = [];
  for (const file of files) {
    const fileSlug = file.replace(/\.md$/, "");
    const markdown = readFileSync(path.join(LESSONS_DIR, file), "utf8");
    const title = titleFromMarkdown(markdown);
    const issues = [];
    if (!title) issues.push("no H1 title");
    const slug = title ? slugFor(title) : fileSlug;
    if (title && slug !== fileSlug) issues.push(`filename slug "${fileSlug}" != slug(title) "${slug}"`);
    const missing = required.filter((h) => !markdown.includes(h));
    if (missing.length) issues.push(`missing sections: ${missing.join(", ")}`);
    if (/\bShona\b|\bJay\b/.test(markdown)) issues.push("contains personal advisor names");
    if (/—/.test(markdown)) issues.push("contains em dash");
    if (issues.length) problems.push(`${file}: ${issues.join("; ")}`);
    lessons.push({
      file,
      slug,
      title: title || fileSlug,
      strategyKey: strategyKeyFor(slug),
      summary: summarize(markdown),
      markdown,
      hash: contentHash(markdown)
    });
  }
  return { lessons, problems };
}

// ── wrangler + portal helpers (mirrors seed-preview-knowledge.mjs) ───────────
async function execWrangler(args, options = {}) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: { ...process.env },
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024
  });
  return stdout;
}

function d1Args(sql) {
  const envArgs = WRANGLER_ENV ? ["--env", WRANGLER_ENV] : [];
  return ["d1", "execute", TARGET_DB, ...envArgs, WRANGLER_REMOTE, "--json", "--command", sql];
}

async function d1Results(sql) {
  const stdout = await execWrangler(d1Args(sql));
  const json = JSON.parse(stdout || "[]");
  return json?.[0]?.results ?? [];
}

async function r2Get(key) {
  const envArgs = WRANGLER_ENV ? ["--env", WRANGLER_ENV] : [];
  return execWrangler(["r2", "object", "get", `${TARGET_BUCKET}/${key}`, ...envArgs, WRANGLER_REMOTE, "--pipe"], {
    maxBuffer: 8 * 1024 * 1024
  });
}

async function portalFetch(pathname, options = {}, cookieJar = null) {
  const headers = { ...(options.headers ?? {}) };
  if (cookieJar?.cookie) headers.cookie = cookieJar.cookie;
  const response = await fetch(`${PORTAL_ORIGIN}${pathname}`, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (cookieJar && setCookie) cookieJar.cookie = setCookie.split(";")[0];
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, text, json };
}

async function adminLogin() {
  if (!process.env.ADMIN_MASTER_PASSWORD) {
    throw new Error("ADMIN_MASTER_PASSWORD is required for writes (apply/rollback).");
  }
  const cookieJar = {};
  const result = await portalFetch(
    ADMIN_AUTH_PATH,
    { method: "POST", headers: HEADERS_JSON, body: JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD }) },
    cookieJar
  );
  if (!result.response.ok || result.json?.role !== "admin") {
    throw new Error(`Admin authentication failed: ${result.response.status} ${result.text.slice(0, 160)}`);
  }
  return cookieJar;
}

async function postAdmin(cookieJar, pathname, body = null) {
  const result = await portalFetch(
    pathname,
    { method: "POST", headers: HEADERS_JSON, body: body ? JSON.stringify(body) : "{}" },
    cookieJar
  );
  if (!result.response.ok) {
    throw new Error(`POST ${pathname} failed: ${result.response.status} ${result.text.slice(0, 200)}`);
  }
  return result.json;
}

async function putAdmin(cookieJar, pathname, body) {
  const result = await portalFetch(
    pathname,
    { method: "PUT", headers: HEADERS_JSON, body: JSON.stringify(body) },
    cookieJar
  );
  if (!result.response.ok) {
    throw new Error(`PUT ${pathname} failed: ${result.response.status} ${result.text.slice(0, 200)}`);
  }
  return result.json;
}

async function lookupExistingPages(slugs) {
  const rows = await d1Results(
    `SELECT id, slug, title, status, compiled_r2_key FROM wiki_pages WHERE tenant_id = '${TENANT_ID}' AND slug IN (${quoted(slugs)})`
  );
  const map = new Map();
  for (const row of rows) map.set(row.slug, row);
  return map;
}

// ── modes ────────────────────────────────────────────────────────────────
function dryRun(lessons, problems) {
  console.log(`Dry run: ${lessons.length} playbooks found in ${LESSONS_DIR}.`);
  console.log(`Target portal: ${PORTAL_ORIGIN} | D1: ${TARGET_DB} | bucket: ${TARGET_BUCKET}`);
  if (problems.length) {
    console.log(`\nVALIDATION PROBLEMS (${problems.length}):`);
    for (const p of problems) console.log(`  ✗ ${p}`);
  } else {
    console.log("  ✓ all playbooks pass structural validation (title, required sections, voice, no em dashes).");
  }
  console.log("\nPlanned upserts (publish each as an approved wiki page):");
  for (const l of lessons) {
    console.log(`  - ${l.slug}  [${l.strategyKey}]  "${l.title}"`);
  }
  const runDir = ensureRunDir();
  const planPath = path.join(runDir, "plan.json");
  writeFileSync(
    planPath,
    JSON.stringify(
      {
        mode: "dry-run",
        at: nowIso(),
        portal: PORTAL_ORIGIN,
        db: TARGET_DB,
        problems,
        lessons: lessons.map((l) => ({ file: l.file, slug: l.slug, title: l.title, strategyKey: l.strategyKey, summary: l.summary, hash: l.hash }))
      },
      null,
      2
    )
  );
  console.log(`\nWrote plan to ${planPath}.`);
  if (problems.length) {
    process.exitCode = 1;
    console.log("\nFix the validation problems above before running --apply.");
  } else {
    console.log("\nReady. Run --apply with ADMIN_MASTER_PASSWORD set to publish.");
  }
}

async function apply(lessons, problems) {
  if (problems.length) {
    throw new Error(`Refusing to apply: ${problems.length} validation problems. Run --dry-run.`);
  }
  console.log(`Apply: publishing ${lessons.length} playbooks to ${PORTAL_ORIGIN}.`);
  const health = await portalFetch("/api/health");
  if (!health.response.ok || health.json?.ok !== true) {
    throw new Error(`Portal health check failed: ${health.response.status} ${health.text.slice(0, 160)}`);
  }
  const cookieJar = await adminLogin();
  const existing = await lookupExistingPages(lessons.map((l) => l.slug));
  const runDir = ensureRunDir();
  const manifest = { mode: "apply", at: nowIso(), portal: PORTAL_ORIGIN, db: TARGET_BUCKET, entries: [] };

  for (const lesson of lessons) {
    const page = existing.get(lesson.slug);
    let wikiId;
    let action;
    let backupHash = null;
    if (page) {
      action = "update";
      wikiId = page.id;
      try {
        const current = await r2Get(page.compiled_r2_key);
        writeFileSync(path.join(runDir, "backups", `${lesson.slug}.md`), current);
        backupHash = contentHash(current);
      } catch (error) {
        console.log(`  ! ${lesson.slug}: could not back up current markdown (${String(error).slice(0, 80)}).`);
      }
    } else {
      action = "create";
      const created = await postAdmin(cookieJar, "/api/admin/sources", {
        title: lesson.title,
        sourceType: "strategy_doc",
        content: lesson.markdown,
        strategyKey: lesson.strategyKey,
        visibility: "client",
        visibilityTier: "mid",
        effectiveYear: "2026",
        audience: "clients",
        reviewOwner: "admin"
      });
      const ingested = await postAdmin(cookieJar, `/api/admin/sources/${encodeURIComponent(created.id)}/ingest`);
      wikiId = ingested.wikiId;
    }
    // Store the exact playbook markdown (title + summary are derived server-side), then publish.
    await putAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(wikiId)}`, { markdown: lesson.markdown });
    await postAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(wikiId)}/publish`);
    manifest.entries.push({ slug: lesson.slug, title: lesson.title, action, wikiId, newHash: lesson.hash, backupHash });
    console.log(`  ✓ ${action} ${lesson.slug} (${wikiId})`);
  }

  const manifestPath = path.join(runDir, "apply-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(RUNS_DIR, "latest-apply-manifest.json"), JSON.stringify({ ...manifest, runDir }, null, 2));
  console.log(`\nApplied ${manifest.entries.length} playbooks. Manifest: ${manifestPath}`);
  console.log("Run --validate to confirm, or --rollback to restore the backed-up versions.");
}

async function validate(lessons) {
  console.log(`Validate: checking ${lessons.length} published pages in ${TARGET_DB}.`);
  const map = await lookupExistingPages(lessons.map((l) => l.slug));
  const failures = [];
  for (const lesson of lessons) {
    const page = map.get(lesson.slug);
    if (!page) failures.push(`${lesson.slug}: not found`);
    else if (page.status !== "published") failures.push(`${lesson.slug}: status=${page.status}`);
    else if (page.title !== lesson.title) failures.push(`${lesson.slug}: title="${page.title}" != "${lesson.title}"`);
  }
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f}`);
    throw new Error(`${failures.length} pages failed validation.`);
  }
  console.log(`  ✓ all ${lessons.length} pages published with matching titles.`);
}

async function rollback(manifestPath) {
  const file = manifestPath || path.join(RUNS_DIR, "latest-apply-manifest.json");
  if (!existsSync(file)) throw new Error(`No manifest at ${file}. Pass --manifest <path>.`);
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const runDir = manifest.runDir || path.dirname(file);
  console.log(`Rollback: restoring from ${file}.`);
  const cookieJar = await adminLogin();
  let restored = 0;
  const created = [];
  for (const entry of manifest.entries) {
    if (entry.action === "update" && entry.backupHash) {
      const backupPath = path.join(runDir, "backups", `${entry.slug}.md`);
      if (!existsSync(backupPath)) {
        console.log(`  ! ${entry.slug}: backup file missing, skipping.`);
        continue;
      }
      const prior = readFileSync(backupPath, "utf8");
      await putAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(entry.wikiId)}`, { markdown: prior });
      await postAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(entry.wikiId)}/publish`);
      restored += 1;
      console.log(`  ✓ restored ${entry.slug}`);
    } else if (entry.action === "create") {
      created.push(entry.slug);
    }
  }
  console.log(`\nRestored ${restored} updated pages.`);
  if (created.length) {
    console.log(`Note: ${created.length} pages were newly created and have no prior version to restore: ${created.join(", ")}.`);
    console.log("Unpublish or remove these via the admin console if the import is being fully reverted.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { lessons, problems } = loadLessons();
  if (args.mode === "dry-run") {
    dryRun(lessons, problems);
  } else if (args.mode === "apply") {
    await apply(lessons, problems);
  } else if (args.mode === "validate") {
    await validate(lessons);
  } else if (args.mode === "rollback") {
    await rollback(args.manifestPath);
  }
}

main().catch((error) => {
  console.error(`\nimport-playbooks failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
