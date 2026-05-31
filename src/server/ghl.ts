import { createId, nowIso, sha256, timingSafeEqualText } from "./crypto";
import { first, run, tenantId } from "./db";
import { ALLOWED_GHL_TAGS } from "./personalization";

interface GhlContactPayload {
  id?: string;
  contactId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  lifecycleStage?: string;
}

interface GhlContactSearchResult {
  id?: string;
  contact?: {
    id?: string;
    contactId?: string;
  };
  contacts?: Array<{
    id?: string;
    contactId?: string;
  }>;
}

interface GhlContactCreateResult {
  id?: string;
  contact?: {
    id?: string;
    contactId?: string;
  };
}

interface LegacyGhlContactsResult {
  contacts?: Array<{
    id?: string;
    email?: string | null;
  }>;
}

export async function verifyGhlWebhook(env: Env, body: string, signature: string | null): Promise<boolean> {
  if (!env.GHL_WEBHOOK_SECRET) {
    return env.ENVIRONMENT === "development";
  }
  if (!signature) {
    return false;
  }
  const expected = await sha256(`${env.GHL_WEBHOOK_SECRET}.${body}`);
  return timingSafeEqualText(expected, signature);
}

export async function applyGhlWebhook(env: Env, payload: GhlContactPayload & { eventId?: string }): Promise<void> {
  const externalId = payload.eventId || payload.id || payload.contactId || createId("ghl_event");
  const payloadHash = await sha256(JSON.stringify(payload));
  const seen = await first<any>(env, "SELECT id FROM webhook_events WHERE provider = ? AND external_id = ? LIMIT 1", "gohighlevel", externalId);
  if (seen) {
    return;
  }
  await run(
    env,
    "INSERT INTO webhook_events (id, tenant_id, provider, external_id, status, payload_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    createId("webhook"),
    tenantId(),
    "gohighlevel",
    externalId,
    "received",
    payloadHash,
    nowIso()
  );

  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    return;
  }
  const allowedTags = normalizeGhlTags(payload.tags || []);
  const tier = allowedTags.includes("high") ? "high" : allowedTags.includes("low") ? "low" : "mid";
  const now = nowIso();
  const existing = await first<any>(env, "SELECT id FROM client_profiles WHERE tenant_id = ? AND email = ? LIMIT 1", tenantId(), email);
  const name = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || email.split("@")[0];
  if (existing) {
    await run(
      env,
      "UPDATE client_profiles SET name = ?, ghl_contact_id = ?, tier = ?, lifecycle_stage = ?, tags_json = ?, has_children = ?, updated_at = ? WHERE id = ?",
      name,
      payload.contactId || payload.id || null,
      tier,
      payload.lifecycleStage || "active",
      JSON.stringify(allowedTags),
      allowedTags.includes("hire-kids") || allowedTags.includes("has-kids") ? 1 : 0,
      now,
      existing.id
    );
  } else {
    await run(
      env,
      `INSERT INTO client_profiles (
        id, tenant_id, email, name, ghl_contact_id, tier, entity_type, lifecycle_stage,
        tags_json, has_children, access_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createId("client"),
      tenantId(),
      email,
      name,
      payload.contactId || payload.id || null,
      tier,
      "unknown",
      payload.lifecycleStage || "active",
      JSON.stringify(allowedTags),
      allowedTags.includes("hire-kids") || allowedTags.includes("has-kids") ? 1 : 0,
      "active",
      now,
      now
    );
  }
}

function normalizeGhlTags(tags: string[]): string[] {
  const aliases: Record<string, string> = {
    kids: "has-kids",
    children: "has-kids",
    "has kids": "has-kids",
    "s corp": "s-corp",
    "s-corp": "s-corp",
    scorp: "s-corp",
    "short-term-rental": "str",
    "short term rental": "str",
    "real estate professional": "real-estate",
    retirement: "retirement-planning",
    "irs notice": "irs-notice",
    "home office": "home-office",
    "worker classification": "worker-classification",
    "entity protection": "entity-protection"
  };
  const allowed = new Set(ALLOWED_GHL_TAGS);
  const output = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    const canonical = aliases[normalized] || normalized.replace(/\s+/g, "-");
    if (allowed.has(canonical)) {
      output.add(canonical);
    }
  }
  return Array.from(output);
}

export async function findGhlContactIdByEmail(env: Env, email: string): Promise<string | null> {
  if (env.GHL_ENABLED !== "true" || !env.GHL_API_KEY || !env.GHL_LOCATION_ID) {
    return null;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const params = new URLSearchParams({
    locationId: env.GHL_LOCATION_ID,
    email: normalizedEmail
  });
  const response = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Version: "2021-07-28",
      Accept: "application/json"
    }
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status === 401) {
    return findLegacyGhlContactIdByEmail(env, normalizedEmail);
  }
  if (!response.ok) {
    throw new Error(`GoHighLevel contact lookup failed with ${response.status}`);
  }
  const json = await response.json<GhlContactSearchResult>();
  return json.contact?.id || json.contact?.contactId || json.contacts?.[0]?.id || json.contacts?.[0]?.contactId || json.id || null;
}

export async function createGhlContact(
  env: Env,
  input: { email: string; firstName: string; lastName: string; source?: string }
): Promise<{ contactId: string; created: boolean }> {
  if (env.GHL_ENABLED !== "true" || !env.GHL_API_KEY || !env.GHL_LOCATION_ID) {
    throw new Error("GoHighLevel integration is not configured.");
  }

  const email = input.email.trim().toLowerCase();
  const existingContactId = await findGhlContactIdByEmail(env, email);
  if (existingContactId) {
    return { contactId: existingContactId, created: false };
  }

  const response = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locationId: env.GHL_LOCATION_ID,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      source: input.source || "Ask Advisor portal"
    })
  });

  if (!response.ok) {
    throw new Error(`GoHighLevel contact creation failed with ${response.status}`);
  }

  const json = await response.json<GhlContactCreateResult>();
  const contactId = json.contact?.id || json.contact?.contactId || json.id;
  if (!contactId) {
    throw new Error("GoHighLevel contact creation did not return a contact id.");
  }

  return { contactId, created: true };
}

export async function sendGhlLoginCode(
  env: Env,
  input: { email: string; code: string; expiresAt: string; contactId?: string | null }
): Promise<void> {
  const contactId = input.contactId ?? (await findGhlContactIdByEmail(env, input.email));
  if (!contactId) {
    throw new Error("No matching GoHighLevel contact found for this portal email.");
  }
  const response = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Version: "2021-04-15",
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "Email",
      contactId,
      locationId: env.GHL_LOCATION_ID,
      emailTo: input.email,
      subject: "Your Ask Advisor login code",
      message: `Your Ask Advisor login code is ${input.code}. It expires at ${input.expiresAt}.`,
      html: `<p>Your Ask Advisor login code is <strong>${input.code}</strong>.</p><p>It expires at ${input.expiresAt}.</p>`
    })
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("GoHighLevel login email requires a v2 Private Integration token with conversation message permissions.");
    }
    throw new Error(`GoHighLevel login email failed with ${response.status}`);
  }
}

async function findLegacyGhlContactIdByEmail(env: Env, normalizedEmail: string): Promise<string | null> {
  const params = new URLSearchParams({ query: normalizedEmail });
  const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Accept: "application/json"
    }
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GoHighLevel legacy contact lookup failed with ${response.status}`);
  }
  const json = await response.json<LegacyGhlContactsResult>();
  return json.contacts?.find((contact) => contact.email?.trim().toLowerCase() === normalizedEmail)?.id || null;
}

export async function sendGhlEscalation(env: Env, input: { clientEmail: string; summary: string; portalUrl: string }): Promise<string | null> {
  if (env.GHL_ENABLED !== "true" || !env.GHL_API_KEY || !env.GHL_LOCATION_ID) {
    return null;
  }
  const response = await fetch(`https://services.leadconnectorhq.com/tasks/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GHL_API_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locationId: env.GHL_LOCATION_ID,
      title: `Ask Advisor escalation for ${input.clientEmail}`,
      body: `${input.summary}\n\nSecure portal: ${input.portalUrl}`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
  });
  if (!response.ok) {
    throw new Error(`GoHighLevel escalation failed with ${response.status}`);
  }
  const json = await response.json<any>();
  return json.id || json.task?.id || null;
}
