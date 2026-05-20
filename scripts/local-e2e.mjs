#!/usr/bin/env node

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.PORT || 8787);
const origin = `http://localhost:${port}`;
const timeoutMs = 45_000;

const child = spawn("npx", ["wrangler", "dev", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NO_COLOR: "1" }
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

const cookieJar = new Map();

function storeCookies(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return;
  }
  for (const cookie of setCookie.split(/,(?=\s*[^;]+=)/)) {
    const [pair] = cookie.trim().split(";");
    const [name, value] = pair.split("=");
    cookieJar.set(name, value);
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(cookieJar.size > 0 ? { cookie: cookieHeader() } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${origin}${path}`, { ...options, headers });
  storeCookies(response);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return body;
}

async function waitForServer() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (output.includes("Ready on")) {
      try {
        await api("/api/health");
        return;
      } catch {
        // Keep waiting for D1/R2 local bindings to finish startup.
      }
    }
    await delay(500);
  }
  throw new Error(`Wrangler dev did not become ready.\n${output.slice(-3000)}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  await waitForServer();

  const codeRequest = await api("/api/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email: "client@example.com" })
  });
  assert(/^\d{6}$/.test(codeRequest.devCode || ""), "development login code was not returned");

  const clientMe = await api("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email: "client@example.com", code: codeRequest.devCode })
  });
  assert(clientMe.authenticated && clientMe.role === "client", "client login failed");

  const answer = await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ question: "I have children and an S-corp. What should I understand before hiring my kids?" })
  });
  assert(answer.citations?.length > 0, "chat answer did not include citations");
  assert(answer.recommendedTrainings?.length > 0, "chat answer did not recommend trainings");
  assert(answer.nextSteps?.length > 0, "chat answer did not include next steps");

  const feedback = await api("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      conversationId: answer.conversationId,
      rating: "helpful",
      category: "answer_quality",
      note: "Local E2E feedback"
    })
  });
  assert(feedback.ok === true, "answer feedback was not accepted");

  const escalation = await api("/api/escalations", {
    method: "POST",
    body: JSON.stringify({
      conversationId: answer.conversationId,
      question: "Please have the team review this answer.",
      reason: "Local E2E explicit escalation"
    })
  });
  assert(escalation.ok === true && escalation.id, "explicit escalation was not created");

  const trainings = await api("/api/trainings");
  assert(trainings.trainings?.length > 0, "training vault returned no trainings");
  const trainingSlug = answer.recommendedTrainings[0].url.replace("/trainings/", "");
  const training = await api(`/api/trainings/${trainingSlug}`);
  assert(training.page?.title, "recommended training did not load");

  await api("/api/auth/logout", { method: "POST", body: "{}" });

  const adminCodeRequest = await api("/api/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email: "admin@beyondfreedomfinancial.com" })
  });
  assert(/^\d{6}$/.test(adminCodeRequest.devCode || ""), "admin development login code was not returned");
  const adminMe = await api("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email: "admin@beyondfreedomfinancial.com", code: adminCodeRequest.devCode })
  });
  assert(adminMe.authenticated && adminMe.role === "admin", "admin login failed");

  const unique = Date.now();
  const source = await api("/api/admin/sources", {
    method: "POST",
    body: JSON.stringify({
      title: `Local E2E Source ${unique}`,
      sourceType: "training",
      strategyKey: "local-e2e",
      effectiveYear: "2026",
      content:
        "This local E2E source confirms admin upload, draft compilation, publication, and health checks. Clients should ask the team before taking action on facts that require personalized review."
    })
  });
  assert(source.id, "admin source creation failed");

  const ingest = await api(`/api/admin/sources/${source.id}/ingest`, { method: "POST", body: "{}" });
  assert(ingest.wikiId, "source ingest did not produce a wiki page");

  await api(`/api/admin/wiki/${ingest.wikiId}/publish`, { method: "POST", body: "{}" });
  const health = await api("/api/admin/health/run", { method: "POST", body: "{}" });
  assert(typeof health.created === "number", "health check did not return a finding count");

  console.log("Local E2E passed: client chat, citations, feedback, escalation, trainings, admin ingest, publish, and health checks.");
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    console.error(output.slice(-3000));
    process.exitCode = 1;
  })
  .finally(async () => {
    child.kill("SIGTERM");
    await delay(500);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  });
