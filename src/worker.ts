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
import { all, first, mapEscalation, mapHealth, mapSource, mapWiki, recordAuditEvent, run, seedIfNeeded, tenantId } from "./server/db";
import { createEscalation, answerQuestion, getTrainingBySlug } from "./server/knowledge";
import { applyGhlWebhook, createGhlContact, sendGhlEscalation, verifyGhlWebhook } from "./server/ghl";
import { createSource, processSource, publishWikiPage, updateWikiPage } from "./server/ingest";
import { runHealthChecks } from "./server/health";
import { createId, nowIso } from "./server/crypto";
import type { ClientProfile, WikiPage } from "./shared/types";
import { sendLoginCodeEmail } from "./server/email";
import { allowedVisibilityTiers } from "./server/vector";
import { notifyGhlEscalation } from "./server/escalations";
import { adminListAssets, assetForDownload, assetsForSlug, contentDisposition, deleteAsset, publishedAssets } from "./server/assets";
import { buildAdminReview } from "./server/review";
import { recommendPagesForClient } from "./server/personalization";

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
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.use("*", async (c, next) => {
  await seedIfNeeded(c.env);
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'");
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
  await recordAuditEvent(c.env, {
    actor: email,
    action: "auth.request_code",
    targetType: "auth_code",
    targetId: email,
    metadata: { expiresAt }
  });
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
  await recordAuditEvent(c.env, {
    actor: session.adminEmail || "master-password",
    action: "auth.admin_password",
    targetType: "session",
    targetId: session.sessionId,
    metadata: { method: "master_password" }
  });
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
  const trainings = rows.map((row) => mapWiki(row));
  const assets = await publishedAssets(c.env, session.client.tier);
  return c.json({ trainings, recommended: recommendPagesForClient(session.client, trainings, assets) });
});

app.get("/api/trainings/:slug", async (c) => {
  const session = await requireClient(c);
  const slug = c.req.param("slug");
  const training = await getTrainingBySlug(c.env, slug);
  if (!training) {
    return c.json({ error: "Training not found." }, 404);
  }
  const assets = await assetsForSlug(c.env, slug, session.client.tier);
  return c.json({ page: mapWiki(training.page, training.markdown), assets });
});

app.get("/api/assets/:id/download", async (c) => {
  const session = await getSession(c);
  if (!session) {
    throw new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const tier = session.role === "admin" ? "high" : (session.client?.tier ?? "low");
  const asset = await assetForDownload(c.env, c.req.param("id"), tier);
  if (!asset) {
    return c.json({ error: "Download not found." }, 404);
  }
  const object = await c.env.CONTENT_BUCKET.get(asset.r2_key);
  if (!object?.body) {
    return c.json({ error: "Download file is missing." }, 404);
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.mime_type,
      "Content-Disposition": contentDisposition(asset.filename),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff"
    }
  });
});

app.get("/api/plan", async (c) => {
  const session = await requireClient(c);
  const rows = await all<any>(
    c.env,
    "SELECT * FROM wiki_pages WHERE tenant_id = ? AND status = 'published' ORDER BY published_at DESC, title ASC",
    tenantId()
  );
  const pages = rows.map((row) => mapWiki(row)) as WikiPage[];
  const assets = await publishedAssets(c.env, session.client.tier);
  const recommended = recommendPagesForClient(session.client, pages, assets);
  const items = recommended.length
    ? recommended
    : [{
        title: "Estimated Tax Payment System",
        done: false,
        reason: "Review profit and withholding before the next quarterly payment.",
        strategyKey: "estimated-tax-system",
        slug: "estimated-tax-payment-system"
      }];
  // Read saved completion state. Keep the try around ONLY the read — never the
  // response build — and on failure report progress as unknown (nothing done)
  // rather than fabricating defaults that would erase a client's real checkmarks.
  let progress: Map<string, boolean> | null = new Map();
  try {
    const progressRows = await all<{ title: string; done: number }>(
      c.env,
      "SELECT title, done FROM plan_item_progress WHERE tenant_id = ? AND client_id = ?",
      tenantId(),
      session.client.id
    );
    progress = new Map(progressRows.map((row) => [row.title, Boolean(row.done)]));
  } catch (error) {
    progress = null;
    await recordAuditEvent(c.env, {
      actor: session.client.id,
      action: "plan.progress_read_failed",
      targetType: "client_profile",
      targetId: session.client.id,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    });
  }
  return c.json({
    items: items.map((item, index) => ({
      ...item,
      done:
        progress === null
          ? false // read failed: report no known progress, never fabricate
          : progress.has(item.title)
            ? Boolean(progress.get(item.title))
            : index === 0 // first item is seeded done for a fresh checklist
    }))
  });
});

app.patch("/api/plan/items", async (c) => {
  const session = await requireClient(c);
  const body = await readJson<{ title?: string; strategyKey?: string; done?: boolean }>(c.req.raw);
  if (!body.title || typeof body.done !== "boolean") {
    return c.json({ error: "Plan item title and done state are required." }, 400);
  }
  const now = nowIso();
  await run(
    c.env,
    `INSERT INTO plan_item_progress (
      id, tenant_id, client_id, title, strategy_key, done, committed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, client_id, title) DO UPDATE SET
      strategy_key = excluded.strategy_key,
      done = excluded.done,
      committed_at = excluded.committed_at,
      updated_at = excluded.updated_at`,
    createId("plan"),
    tenantId(),
    session.client.id,
    body.title,
    body.strategyKey || "general",
    body.done ? 1 : 0,
    body.done ? now : null,
    now,
    now
  );
  return c.json({ ok: true });
});

app.get("/api/admin/assets", async (c) => {
  await requireAdmin(c);
  const assets = await adminListAssets(c.env);
  return c.json({ assets });
});

app.delete("/api/admin/assets/:id", async (c) => {
  await requireAdmin(c);
  const r2Key = await deleteAsset(c.env, c.req.param("id"));
  if (!r2Key) {
    return c.json({ error: "Asset not found." }, 404);
  }
  await c.env.CONTENT_BUCKET.delete(r2Key);
  return c.json({ ok: true });
});

app.get("/api/admin/dashboard", async (c) => {
  await requireAdmin(c);
  const [sources, wikiPages, healthFindings, escalations, conversationCount, review] = await Promise.all([
    all<any>(c.env, "SELECT * FROM source_documents WHERE tenant_id = ? ORDER BY updated_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM wiki_pages WHERE tenant_id = ? ORDER BY updated_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM health_findings WHERE tenant_id = ? AND status = 'open' ORDER BY created_at DESC", tenantId()),
    all<any>(c.env, "SELECT * FROM escalations WHERE tenant_id = ? ORDER BY created_at DESC", tenantId()),
    first<{ total: number }>(c.env, "SELECT COUNT(*) AS total FROM conversations WHERE tenant_id = ?", tenantId()),
    buildAdminReview(c.env)
  ]);
  return c.json({
    sources: sources.map(mapSource),
    wikiPages: wikiPages.map((row) => mapWiki(row)),
    healthFindings: healthFindings.map(mapHealth),
    escalations: escalations.map(mapEscalation),
    review,
    metrics: {
      publishedPages: wikiPages.filter((page) => page.status === "published").length,
      draftPages: wikiPages.filter((page) => page.status !== "published").length,
      openEscalations: escalations.filter((item) => item.status === "open").length,
      healthFindings: healthFindings.length,
      conversations: conversationCount?.total ?? 0,
      unansweredQuestions: review.unansweredQuestions.length,
      lowConfidenceAnswers: review.lowConfidenceAnswers.length,
      repeatedConfusion: review.repeatedConfusion.length,
      pagesNeedingReview: review.pagesNeedingReview.length
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
    source: "Ask Advisor portal preview"
  });
  await upsertClientProfile(c.env, {
    email,
    name: `${firstName} ${lastName}`,
    ghlContactId: contact.contactId,
    tier
  });
  await recordAuditEvent(c.env, {
    actor: admin.adminEmail || "admin",
    action: contact.created ? "admin.contact_create" : "admin.contact_sync",
    targetType: "client_profile",
    targetId: email,
    metadata: { ghlContactId: contact.contactId, tier }
  });

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
      const body = message.body || {};
      // Terminal: a message with neither handle can never succeed. Ack it (so it
      // stops looping toward the dead-letter queue) but leave an audit trail.
      if (!body.sourceId && !body.escalationId) {
        await recordAuditEvent(env, {
          actor: "queue",
          action: "queue.process_failed",
          targetType: "system",
          targetId: "ingest_queue",
          metadata: { reason: "malformed message: no sourceId or escalationId", keys: Object.keys(body) }
        }).catch(() => {});
        message.ack();
        continue;
      }
      try {
        if (body.sourceId) {
          await processSource(env, body.sourceId, body.actor || "queue");
        }
        if (body.escalationId) {
          await sendGhlEscalation(env, {
            clientEmail: body.clientEmail,
            summary: body.summary,
            portalUrl: body.portalUrl
          });
        }
        message.ack();
      } catch (error) {
        // Can't reliably tell transient from terminal here, so retry — but record
        // every failure (the app has no logger) so a poison message that exhausts
        // its retries and dead-letters leaves a trail of why. The signal write is
        // guarded so it can never itself break message handling.
        await recordAuditEvent(env, {
          actor: "queue",
          action: "queue.process_failed",
          targetType: body.escalationId ? "escalation" : "source",
          targetId: body.escalationId || body.sourceId || "unknown",
          metadata: { keys: Object.keys(body), error: error instanceof Error ? error.message : String(error) }
        }).catch(() => {});
        message.retry();
      }
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await seedIfNeeded(env);
    await runHealthChecks(env);
  }
};
