import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { addMinutesIso, createId, nowIso, randomCode, sha256, timingSafeEqualText } from "./crypto";
import { first, mapClient, run, tenantId } from "./db";
import type { AppMe, ClientProfile, Role } from "../shared/types";

export interface SessionUser {
  sessionId: string;
  role: Role;
  client: ClientProfile | null;
  adminEmail: string | null;
}

export function adminEmailSet(env: Env): Set<string> {
  return new Set(
    env.ADMIN_ACCESS_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requestLoginCode(env: Env, email: string): Promise<{ code: string; expiresAt: string }> {
  const normalized = email.trim().toLowerCase();
  const code = randomCode();
  const codeHash = await sha256(code);
  const now = nowIso();
  const expiresAt = addMinutesIso(10);
  await run(
    env,
    "INSERT INTO auth_codes (id, tenant_id, email, code_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    createId("code"),
    tenantId(),
    normalized,
    codeHash,
    expiresAt,
    null,
    now
  );
  return { code, expiresAt };
}

export async function verifyLoginCode(env: Env, email: string, code: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const codeHash = await sha256(code.trim());
  const row = await first<any>(
    env,
    "SELECT * FROM auth_codes WHERE tenant_id = ? AND email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
    tenantId(),
    normalized
  );
  if (!row || row.expires_at < nowIso() || !timingSafeEqualText(row.code_hash, codeHash)) {
    return null;
  }
  await run(env, "UPDATE auth_codes SET consumed_at = ? WHERE id = ?", nowIso(), row.id);

  const adminEmails = adminEmailSet(env);
  const isAdmin = adminEmails.has(normalized);
  let client = await findClientByEmail(env, normalized);
  if (!client && !isAdmin) {
    if (env.ENVIRONMENT !== "development") {
      return null;
    }
    client = await createLocalClient(env, normalized);
  }

  const sessionId = createId("sess");
  const expiresAt = addMinutesIso(60 * 24 * 14);
  await run(
    env,
    "INSERT INTO sessions (id, tenant_id, client_id, admin_email, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    sessionId,
    tenantId(),
    client?.id ?? null,
    isAdmin ? normalized : null,
    isAdmin ? "admin" : "client",
    expiresAt,
    nowIso()
  );

  return {
    sessionId,
    role: isAdmin ? "admin" : "client",
    client,
    adminEmail: isAdmin ? normalized : null
  };
}

export async function createAdminPasswordSession(env: Env, password: string): Promise<SessionUser | null> {
  const configured = env.ADMIN_MASTER_PASSWORD?.trim();
  const supplied = password.trim();
  if (!configured || !supplied || !timingSafeEqualText(configured, supplied)) {
    return null;
  }

  const sessionId = createId("sess");
  const adminEmail = "master-password";
  const expiresAt = addMinutesIso(60 * 24 * 7);
  await run(
    env,
    "INSERT INTO sessions (id, tenant_id, client_id, admin_email, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    sessionId,
    tenantId(),
    null,
    adminEmail,
    "admin",
    expiresAt,
    nowIso()
  );

  return {
    sessionId,
    role: "admin",
    client: null,
    adminEmail
  };
}

export async function createLocalClient(env: Env, email: string): Promise<ClientProfile> {
  const now = nowIso();
  const id = createId("client");
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  await run(
    env,
    `INSERT INTO client_profiles (
      id, tenant_id, email, name, ghl_contact_id, tier, entity_type, lifecycle_stage, tags_json,
      has_children, access_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId(),
    email,
    name,
    null,
    "mid",
    "unknown",
    "active",
    JSON.stringify(["estimated-taxes"]),
    0,
    "active",
    now,
    now
  );
  const created = await findClientByEmail(env, email);
  if (!created) {
    throw new Error("Unable to create local client profile");
  }
  return created;
}

export async function findClientByEmail(env: Env, email: string): Promise<ClientProfile | null> {
  const row = await first<any>(
    env,
    "SELECT * FROM client_profiles WHERE tenant_id = ? AND email = ? LIMIT 1",
    tenantId(),
    email.trim().toLowerCase()
  );
  return row ? mapClient(row) : null;
}

export async function getSession(c: Context<{ Bindings: Env }>): Promise<SessionUser | null> {
  const env = c.env;
  const cookieName = sessionCookieName(env);
  const sessionId = getCookie(c, cookieName);
  if (!sessionId) {
    return null;
  }
  const row = await first<any>(env, "SELECT * FROM sessions WHERE id = ? AND tenant_id = ? LIMIT 1", sessionId, tenantId());
  if (!row || row.expires_at < nowIso()) {
    return null;
  }
  const client = row.client_id
    ? await first<any>(env, "SELECT * FROM client_profiles WHERE id = ? AND tenant_id = ? LIMIT 1", row.client_id, tenantId())
    : null;
  return {
    sessionId,
    role: row.role,
    client: client ? mapClient(client) : null,
    adminEmail: row.admin_email
  };
}

export function setSessionCookie(c: Context<{ Bindings: Env }>, sessionId: string): void {
  const cookieName = sessionCookieName(c.env);
  setCookie(c, cookieName, sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== "development",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): void {
  const cookieName = sessionCookieName(c.env);
  setCookie(c, cookieName, "", {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== "development",
    sameSite: "Lax",
    path: "/",
    maxAge: 0
  });
}

function sessionCookieName(env: Env): string {
  const configured = env.SESSION_COOKIE || "__Host_ask_shona_session";
  if (env.ENVIRONMENT === "development" && configured.startsWith("__Host_")) {
    return configured.replace("__Host_", "");
  }
  return configured;
}

export async function me(c: Context<{ Bindings: Env }>): Promise<AppMe> {
  const session = await getSession(c);
  if (!session) {
    return { authenticated: false, role: null, client: null, adminEmail: null };
  }
  return {
    authenticated: true,
    role: session.role,
    client: session.client,
    adminEmail: session.adminEmail
  };
}
