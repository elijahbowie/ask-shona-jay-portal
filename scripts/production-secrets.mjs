#!/usr/bin/env node

import { spawn } from "node:child_process";

const requiredSecrets = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GHL_WEBHOOK_SECRET",
  "ADMIN_MASTER_PASSWORD"
];

const mode = process.argv.includes("--push") ? "push" : "check";
const missing = requiredSecrets.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  console.error("No secret values were printed or sent.");
  process.exit(1);
}

if (mode === "check") {
  console.log(`All required production secret environment variables are present: ${requiredSecrets.join(", ")}`);
  process.exit(0);
}

async function putSecret(name) {
  const child = spawn("npx", ["wrangler", "secret", "put", name, "--env", "production"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1" }
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.stdin.write(process.env[name] || "");
  child.stdin.end("\n");

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`Failed to set ${name}: ${(stderr || stdout).slice(-1200)}`);
  }
  console.log(`Set production secret: ${name}`);
}

for (const secret of requiredSecrets) {
  await putSecret(secret);
}

console.log("Production secrets pushed. Run `npm run readiness` next.");
