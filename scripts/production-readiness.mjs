#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootFiles = [
  "wrangler.jsonc",
  "migrations/0001_initial.sql",
  "src/worker.ts",
  "src/client/main.tsx",
  "src/server/knowledge.ts",
  "src/server/ingest.ts",
  "src/server/vector.ts"
];

const requiredSecrets = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GHL_WEBHOOK_SECRET",
  "ADMIN_MASTER_PASSWORD"
];

const portalOrigin = "https://ask.beyondfreedomfinancial.com";
const originalOrigin = "https://beyondfreedomfinancial.com";
const readinessLoginEmail = process.env.READINESS_LOGIN_EMAIL || "alex@example.com";

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

function isAdminProtected(response, text) {
  return (
    (response.status === 403 && text.includes("Admin authentication required")) ||
    (response.ok && text.includes("Cloudflare Access") && text.includes("Sign in"))
  );
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { response, text };
}

async function wranglerSecrets() {
  try {
    const { stdout } = await execFileAsync("npx", ["wrangler", "secret", "list", "--env", "production"], {
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout || "[]");
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function productionDemoSeedCount() {
  const demoTitles = [
    "Hiring Your Kids Strategy Training",
    "Augusta Rule Weekly Call Transcript",
    "Estimated Tax Reminder Email"
  ];
  const quotedTitles = demoTitles.map((title) => `'${title.replaceAll("'", "''")}'`).join(", ");
  const command = [
    "SELECT",
    "(SELECT COUNT(*) FROM client_profiles WHERE id = 'client_demo_shona' OR email = 'client@example.com') +",
    `(SELECT COUNT(*) FROM source_documents WHERE title IN (${quotedTitles})) +`,
    `(SELECT COUNT(*) FROM wiki_pages WHERE title IN (${quotedTitles})) +`,
    "(SELECT COUNT(*) FROM knowledge_chunks WHERE source_id IN ('src_ad46bb3adf13c6c59e12c748','src_829858a351eb882282f2bbed','src_8561634705f5b7fe37e041d6'))",
    "AS total"
  ].join(" ");
  try {
    const { stdout } = await execFileAsync(
      "npx",
      ["wrangler", "d1", "execute", "ask-shona-jay-db-production", "--env", "production", "--remote", "--json", "--command", command],
      { maxBuffer: 1024 * 1024 }
    );
    const json = JSON.parse(stdout || "[]");
    return Number(json?.[0]?.results?.[0]?.total ?? -1);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  for (const file of rootFiles) {
    record(`artifact:${file}`, existsSync(file), existsSync(file) ? "present" : "missing");
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/health`);
    record("production health endpoint", response.ok && text.includes('"ok":true'), `${response.status} ${text.slice(0, 120)}`);
  } catch (error) {
    record("production health endpoint", false, String(error));
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/`);
    record("portal subdomain serves app", response.ok && text.includes("Ask Advisor"), `${response.status}`);
  } catch (error) {
    record("portal subdomain serves app", false, String(error));
  }

  try {
    const { response, text } = await fetchText(`${originalOrigin}/`);
    record("original website is not replaced", response.ok && !text.includes("short-lived access code"), `${response.status}`);
  } catch (error) {
    record("original website is not replaced", false, String(error));
  }

  const demoSeedCount = await productionDemoSeedCount();
  if (typeof demoSeedCount === "number") {
    record("production has no demo seed data", demoSeedCount === 0, `${demoSeedCount} demo record(s) found`);
  } else {
    record("production has no demo seed data", false, demoSeedCount.error || "unable to query production D1");
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/trainings`);
    record(
      "client API requires authentication",
      response.status === 401 && text.includes("Client authentication required"),
      `${response.status} ${text.slice(0, 120)}`
    );
  } catch (error) {
    record("client API requires authentication", false, String(error));
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/admin/dashboard`);
    record(
      "admin API requires authentication",
      isAdminProtected(response, text),
      `${response.status} ${text.slice(0, 120)}`
    );
  } catch (error) {
    record("admin API requires authentication", false, String(error));
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/admin/dashboard`, {
      headers: {
        "Cf-Access-Authenticated-User-Email": "admin@beyondfreedomfinancial.com",
        "Cf-Access-Jwt-Assertion": "spoofed"
      }
    });
    record(
      "admin API rejects spoofed Access headers",
      isAdminProtected(response, text),
      `${response.status} ${text.slice(0, 120)}`
    );
  } catch (error) {
    record("admin API rejects spoofed Access headers", false, String(error));
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/webhooks/gohighlevel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "ContactCreate", contact: { email: "client@example.com" } })
    });
    record(
      "GoHighLevel webhook rejects unsigned payloads",
      response.status === 401 && text.includes("Invalid webhook signature"),
      `${response.status} ${text.slice(0, 120)}`
    );
  } catch (error) {
    record("GoHighLevel webhook rejects unsigned payloads", false, String(error));
  }

  const secrets = await wranglerSecrets();
  if (Array.isArray(secrets)) {
    const names = new Set(secrets.map((secret) => secret.name));
    for (const secret of requiredSecrets) {
      record(`secret:${secret}`, names.has(secret), names.has(secret) ? "configured" : "missing");
    }
  } else {
    record("production secrets readable", false, secrets.error || "unable to read secret list");
  }

  try {
    const { response, text } = await fetchText(`${portalOrigin}/api/auth/request-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: readinessLoginEmail })
    });
    const emailConfigured = response.ok && text.includes('"ok":true');
    const expectedBlocker = response.status === 500 && text.includes("GHL_API_KEY");
    record(
      "production GoHighLevel login email path",
      emailConfigured,
      emailConfigured ? "login code request accepted" : expectedBlocker ? "blocked by missing GoHighLevel secrets" : `${response.status} ${text.slice(0, 160)}`
    );
  } catch (error) {
    record("production GoHighLevel login email path", false, String(error));
  }

  const maxName = Math.max(...results.map((item) => item.name.length));
  for (const item of results) {
    const status = item.ok ? "PASS" : "FAIL";
    console.log(`${status} ${item.name.padEnd(maxName)} ${item.detail}`);
  }

  const failures = results.filter((item) => !item.ok);
  if (failures.length > 0) {
    console.error(`\n${failures.length} readiness check(s) failed.`);
    process.exit(1);
  }
  console.log("\nProduction readiness checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
