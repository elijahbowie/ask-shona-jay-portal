import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  clearSessionCookie,
  createAdminPasswordSession,
  getSession,
  me,
  requestLoginCode,
  setSessionCookie,
  verifyLoginCode
} from "./server/auth";
import { all, first, mapEscalation, mapHealth, mapSource, mapWiki, run, seedIfNeeded, tenantId } from "./server/db";
import { createEscalation, answerQuestion, getTrainingBySlug } from "./server/knowledge";
import { applyGhlWebhook, createGhlContact, sendGhlEscalation, verifyGhlWebhook } from "./server/ghl";
import { createSource, processSource, publishWikiPage, updateWikiPage } from "./server/ingest";
import { runHealthChecks } from "./server/health";
import { createId, nowIso } from "./server/crypto";
import type { ClientProfile } from "./shared/types";
import { sendLoginCodeEmail } from "./server/email";
import { allowedVisibilityTiers } from "./server/vector";
import { notifyGhlEscalation } from "./server/escalations";

const app = new Hono<{ Bindings: Env }>();

app.onError((error, c) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return c.json({ error: message }, 500);
});

app.use(
  "*",
  cors({
    origin: (origin, c) => origin || c.env.APP_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "X-GoHighLevel-Signature"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  })
);

app.use("*", async (c, next) => {
  await seedIfNeeded(c.env);
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https://images.unsplash.com https://picsum.photos; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    environment: c.env.ENVIRONMENT,
    time: nowIso()
  })
);

app.post("/api/auth/request-code", async (c) => {
  const body = await readJson<{ email?: string }>(c.req.raw);
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "A valid email is required." }, 400);
  }
  const { code, expiresAt } = await requestLoginCode(c.env, email);
  await sendLoginCodeEmail(c.env, { email, code, expiresAt });
  await run(
    c.env,
    "INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("audit"),
    tenantId(),
    email,
    "auth.request_code",
    "auth_code",
    email,
    JSON.stringify({ expiresAt }),
    nowIso()
  );
  const response: Record<string, unknown> = { ok: true, expiresAt };
  if (c.env.ENVIRONMENT === "development") {
    response.devCode = code;
  }
  return c.json(response);
});

app.post("/api/auth/verify", async (c) => {
  const body = await readJson<{ email?: string; code?: string }>(c.req.raw);
  if (!body.email || !body.code) {
    return c.json({ error: "Email and code are required." }, 400);
  }
  const session = await verifyLoginCode(c.env, body.email, body.code);
  if (!session) {
    return c.json({ error: "Invalid or expired code." }, 401);
  }
  setSessionCookie(c, session.sessionId);
  return c.json({
    authenticated: true,
    role: session.role,
    client: session.client,
    adminEmail: session.adminEmail
  });
});

app.post("/api/auth/admin-password", async (c) => {
  const body = await readJson<{ password?: string }>(c.req.raw);
  if (!body.password) {
    return c.json({ error: "Master password is required." }, 400);
  }
  const session = await createAdminPasswordSession(c.env, body.password);
  if (!session) {
    return c.json({ error: "Invalid master password." }, 401);
  }
  await run(
    c.env,
    "INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("audit"),
    tenantId(),
    session.adminEmail || "master-password",
    "auth.admin_password",
    "session",
    session.sessionId,
    JSON.stringify({ method: "master_password" }),
    nowIso()
  );
  setSessionCookie(c, session.sessionId);
  return c.json({
    authenticated: true,
    role: session.role,
    client: session.client,
    adminEmail: session.adminEmail
  });
});

app.post("/api/auth/logout", async (c) => {
  const session = await getSession(c);
  if (session) {
    await run(c.env, "DELETE FROM sessions WHERE id = ?", session.sessionId);
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => {
  return c.json(await me(c));
});

app.post("/api/chat", async (c) => {
  const session = await requireClient(c);
  const body = await readJson<{ question?: string }>(c.req.raw);
  const question = body.question?.trim();
  if (!question) {
    return c.json({ error: "Question is required." }, 400);
  }
  const answer = await answerQuestion(c.env, session.client, question);
  if (answer.escalationRequired && answer.escalationReason) {
    const escalationId = await createEscalation(c.env, {
      clientId: session.client.id,
      conversationId: answer.conversationId,
      question,
      reason: answer.escalationReason
    });
    const portalUrl = `${c.env.APP_ORIGIN}/admin/questions?escalation=${encodeURIComponent(escalationId)}`;
    await notifyGhlEscalation(c.env, {
      escalationId,
      clientEmail: session.client.email,
      summary: answer.escalationReason,
      portalUrl
    });
  }
  return c.json(answer);
});

app.post("/api/escalations", async (c) => {
  const session = await requireClient(c);
  const body = await readJson<{ conversationId?: string; question?: string; reason?: string }>(c.req.raw);
  if (!body.question || !body.reason) {
    return c.json({ error: "Question and reason are required." }, 400);
  }
  const id = await createEscalation(c.env, {
    clientId: session.client.id,
    conversationId: body.conversationId,
    question: body.question,
    reason: body.reason
  });
  const portalUrl = `${c.env.APP_ORIGIN}/admin/questions?escalation=${encodeURIComponent(id)}`;
  await notifyGhlEscalation(c.env, {
    escalationId: id,
    clientEmail: session.client.email,
    summary: body.reason,
    portalUrl
  });
  return c.json({ ok: true, id });
});

app.post("/api/feedback", async (c) => {
  const session = await requireClient(c);
  const body = await readJson<{ conversationId?: string; rating?: string; category?: string; note?: string }>(c.req.raw);
  if (!body.conversationId || !body.rating) {
    return c.json({ error: "Conversation and rating are required." }, 400);
  }
  await run(
    c.env,
    "INSERT INTO feedback (id, tenant_id, client_id, conversation_id, rating, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("feedback"),
    tenantId(),
    session.client.id,
    body.conversationId,
    body.rating,
    body.category || "general",
    body.note || "",
    nowIso()
  );
  return c.json({ ok: true });
});

app.get("/api/trainings", async (c) => {
  const session = await requireClient(c);
  const allowedTiers = allowedVisibilityTiers(session.client.tier);
  const tierPlaceholders = allowedTiers.map(() => "?").join(", ");
  const rows = await all<any>(
    c.env,
    `SELECT * FROM wiki_pages
     WHERE tenant_id = ? AND status = 'published'
       AND visibility IN ('client', 'public')
       AND visibility_tier IN (${tierPlaceholders})
     ORDER BY published_at DESC, title ASC`,
    tenantId(),
    ...allowedTiers
  );
  return c.json({ trainings: rows.map((row) => mapWiki(row)) });
});

app.get("/api/trainings/:slug", async (c) => {
  await requireClient(c);
  const training = await getTrainingBySlug(c.env, c.req.param("slug"));
  if (!training) {
    return c.json({ error: "Training not found." }, 404);
  }
  return c.json({ page: mapWiki(training.page, training.markdown) });
});

app.get("/api/plan", async (c) => {
  const session = await requireClient(c);
  const tags = new Set(session.client.tags);
  const items = [
    {
      title: "Estimated tax readiness",
      done: false,
      reason: "Review profit and withholding before the next quarterly payment.",
      strategyKey: "estimated-taxes"
    }
  ];
  if (session.client.hasChildren || tags.has("hire-kids")) {
    items.push({
      title: "Hiring kids documentation",
      done: false,
      reason: "Confirm age-appropriate work, reasonable pay, hours, and payroll requirements.",
      strategyKey: "hire-kids"
    });
  }
  if (tags.has("augusta-rule")) {
    items.push({
      title: "Augusta Rule support file",
      done: false,
      reason: "Prepare agenda, meeting notes, business purpose, and comparable rental support.",
      strategyKey: "augusta-rule"
    });
  }
  return c.json({ items });
});

app.get("/api/admin/dashboard", async (c) => {
  await requireAdmin(c);
  const [sources, wikiPages, healthFindings, escalations, conversationCount] = await Promise.all([
    all<any>(c.env, "SELECT * FROM source_documents WHERE tenant_id = ? ORDER BY updated_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM wiki_pages WHERE tenant_id = ? ORDER BY updated_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM health_findings WHERE tenant_id = ? AND status = 'open' ORDER BY created_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM escalations WHERE tenant_id = ? ORDER BY created_at DESC", tenantId()),
    first<{ total: number }>(c.env, "SELECT COUNT(*) AS total FROM conversations WHERE tenant_id = ?", tenantId())
  ]);
  return c.json({
    sources: sources.map(mapSource),
    wikiPages: wikiPages.map((row) => mapWiki(row)),
    healthFindings: healthFindings.map(mapHealth),
    escalations: escalations.map(mapEscalation),
    metrics: {
      publishedPages: wikiPages.filter((page) => page.status === "published").length,
      draftPages: wikiPages.filter((page) => page.status !== "published").length,
      openEscalations: escalations.filter((item) => item.status === "open").length,
      healthFindings: healthFindings.length,
      conversations: conversationCount?.total ?? 0
    }
  });
});

app.post("/api/admin/sources", async (c) => {
  const admin = await requireAdmin(c);
  const body = await readJson<any>(c.req.raw);
  const required = ["title", "sourceType", "content", "strategyKey"];
  for (const key of required) {
    if (!body[key]) {
      return c.json({ error: `${key} is required.` }, 400);
    }
  }
  const id = await createSource(c.env, {
    title: body.title,
    sourceType: body.sourceType,
    content: body.content,
    visibility: body.visibility || "client",
    visibilityTier: body.visibilityTier || "mid",
    strategyKey: body.strategyKey,
    effectiveYear: body.effectiveYear || "2026",
    audience: body.audience || "clients",
    reviewOwner: body.reviewOwner || admin.adminEmail || "admin"
  });
  return c.json({ ok: true, id });
});

app.post("/api/admin/sources/:id/ingest", async (c) => {
  const admin = await requireAdmin(c);
  const wikiId = await processSource(c.env, c.req.param("id"), admin.adminEmail || "admin");
  return c.json({ ok: true, wikiId });
});

app.put("/api/admin/wiki/:id", async (c) => {
  const admin = await requireAdmin(c);
  const body = await readJson<{ markdown?: string }>(c.req.raw);
  if (!body.markdown) {
    return c.json({ error: "Markdown is required." }, 400);
  }
  await updateWikiPage(c.env, c.req.param("id"), body.markdown, admin.adminEmail || "admin");
  return c.json({ ok: true });
});

app.post("/api/admin/wiki/:id/publish", async (c) => {
  const admin = await requireAdmin(c);
  await publishWikiPage(c.env, c.req.param("id"), admin.adminEmail || "admin");
  return c.json({ ok: true });
});

app.post("/api/admin/health/run", async (c) => {
  await requireAdmin(c);
  const created = await runHealthChecks(c.env);
  return c.json({ ok: true, created });
});

app.post("/api/admin/contacts", async (c) => {
  const admin = await requireAdmin(c);
  const body = await readJson<{ email?: string; firstName?: string; lastName?: string; tier?: string }>(c.req.raw);
  const email = body.email?.trim().toLowerCase();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  if (!email || !email.includes("@") || !firstName || !lastName) {
    return c.json({ error: "Email, firstName, and lastName are required." }, 400);
  }

  const tier = body.tier === "low" || body.tier === "mid" || body.tier === "high" ? body.tier : "high";
  const contact = await createGhlContact(c.env, {
    email,
    firstName,
    lastName,
    source: "Ask Shona/Jay portal preview"
  });
  await upsertClientProfile(c.env, {
    email,
    name: `${firstName} ${lastName}`,
    ghlContactId: contact.contactId,
    tier
  });
  await run(
    c.env,
    "INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    createId("audit"),
    tenantId(),
    admin.adminEmail || "admin",
    contact.created ? "admin.contact_create" : "admin.contact_sync",
    "client_profile",
    email,
    JSON.stringify({ ghlContactId: contact.contactId, tier }),
    nowIso()
  );

  return c.json({ ok: true, email, contactId: contact.contactId, created: contact.created });
});

app.post("/api/webhooks/gohighlevel", async (c) => {
  const body = await c.req.text();
  const valid = await verifyGhlWebhook(c.env, body, c.req.header("X-GoHighLevel-Signature") ?? null);
  if (!valid) {
    return c.json({ error: "Invalid webhook signature." }, 401);
  }
  const payload = JSON.parse(body);
  await applyGhlWebhook(c.env, payload);
  return c.json({ ok: true });
});

app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/webhooks/")) {
    return c.json({ error: "Not found." }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

async function requireClient(c: any): Promise<{ client: ClientProfile }> {
  const session = await getSession(c);
  if (!session || session.role !== "client" || !session.client) {
    throw new Response(JSON.stringify({ error: "Client authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  return { client: session.client };
}

async function requireAdmin(c: any): Promise<{ adminEmail: string | null }> {
  const session = await getSession(c);
  if (!session || session.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Admin authentication required." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  return { adminEmail: session.adminEmail };
}

async function upsertClientProfile(
  env: Env,
  input: { email: string; name: string; ghlContactId: string; tier: "low" | "mid" | "high" }
): Promise<void> {
  const now = nowIso();
  const tags = input.tier === "high" ? ["hire-kids", "augusta-rule", "estimated-taxes", "high"] : ["estimated-taxes", input.tier];
  const existing = await first<any>(env, "SELECT id FROM client_profiles WHERE tenant_id = ? AND email = ? LIMIT 1", tenantId(), input.email);
  if (existing) {
    await run(
      env,
      `UPDATE client_profiles
       SET name = ?, ghl_contact_id = ?, tier = ?, lifecycle_stage = ?, tags_json = ?,
           has_children = ?, access_status = ?, updated_at = ?
       WHERE id = ?`,
      input.name,
      input.ghlContactId,
      input.tier,
      "active",
      JSON.stringify(tags),
      tags.includes("hire-kids") ? 1 : 0,
      "active",
      now,
      existing.id
    );
    return;
  }

  await run(
    env,
    `INSERT INTO client_profiles (
      id, tenant_id, email, name, ghl_contact_id, tier, entity_type, lifecycle_stage,
      tags_json, has_children, access_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId("client"),
    tenantId(),
    input.email,
    input.name,
    input.ghlContactId,
    input.tier,
    "unknown",
    "active",
    JSON.stringify(tags),
    tags.includes("hire-kids") ? 1 : 0,
    "active",
    now,
    now
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await app.fetch(request, env, ctx);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const message = error instanceof Error ? error.message : "Unexpected error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    await seedIfNeeded(env);
    for (const message of batch.messages) {
      try {
        if (message.body?.sourceId) {
          await processSource(env, message.body.sourceId, message.body.actor || "queue");
        }
        if (message.body?.escalationId) {
          await sendGhlEscalation(env, {
            clientEmail: message.body.clientEmail,
            summary: message.body.summary,
            portalUrl: message.body.portalUrl
          });
        }
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await seedIfNeeded(env);
    await runHealthChecks(env);
  }
};
