import { describe, expect, it } from "vitest";
import { adminEmailSet, createAdminPasswordSession, requestLoginCode, verifyLoginCode } from "./auth";
import { sha256 } from "./crypto";

interface AuthCodeRow {
  id: string;
  tenant_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

function clientRow(email = "client@example.com") {
  return {
    id: "client_1",
    tenant_id: "tenant_beyond_freedom",
    email,
    name: "Client Example",
    tier: "mid",
    entity_type: "s_corp",
    lifecycle_stage: "active",
    tags_json: JSON.stringify(["hire-kids"]),
    has_children: 1,
    access_status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createAuthTestEnv() {
  const authCodes: AuthCodeRow[] = [];
  const sessions: unknown[] = [];
  const clients = new Map<string, ReturnType<typeof clientRow>>();
  clients.set("client@example.com", clientRow());

  const env = {
    ENVIRONMENT: "development",
    ADMIN_ACCESS_EMAILS: "admin@beyondfreedomfinancial.com, elijah@example.com",
    ADMIN_MASTER_PASSWORD: "test-master-password",
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          first: async () => {
            if (sql.includes("FROM auth_codes")) {
              const email = String(binds[1]);
              return authCodes
                .filter((row) => row.email === email && row.consumed_at === null)
                .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ?? null;
            }
            if (sql.includes("FROM client_profiles")) {
              return clients.get(String(binds[1])) ?? null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes("INSERT INTO auth_codes")) {
              authCodes.push({
                id: String(binds[0]),
                tenant_id: String(binds[1]),
                email: String(binds[2]),
                code_hash: String(binds[3]),
                expires_at: String(binds[4]),
                consumed_at: binds[5] ? String(binds[5]) : null,
                created_at: String(binds[6])
              });
            }
            if (sql.includes("UPDATE auth_codes SET consumed_at")) {
              const id = String(binds[1]);
              const row = authCodes.find((item) => item.id === id);
              if (row) {
                row.consumed_at = String(binds[0]);
              }
            }
            if (sql.includes("INSERT INTO sessions")) {
              sessions.push({ binds });
            }
            return { success: true };
          }
        })
      })
    }
  } as unknown as Env;

  return { env, authCodes, sessions, clients };
}

describe("adminEmailSet", () => {
  it("normalizes configured admin emails", () => {
    const admins = adminEmailSet({ ADMIN_ACCESS_EMAILS: " Admin@Example.com, second@example.com " } as unknown as Env);
    expect(admins.has("admin@example.com")).toBe(true);
    expect(admins.has("second@example.com")).toBe(true);
  });
});

describe("admin master password auth", () => {
  it("creates an admin session from the configured master password", async () => {
    const { env, sessions } = createAuthTestEnv();

    const session = await createAdminPasswordSession(env, "test-master-password");

    expect(session?.role).toBe("admin");
    expect(session?.adminEmail).toBe("master-password");
    expect(session?.client).toBeNull();
    expect(sessions).toHaveLength(1);
  });

  it("rejects missing or incorrect master passwords", async () => {
    const { env, sessions } = createAuthTestEnv();

    await expect(createAdminPasswordSession(env, "WRONG")).resolves.toBeNull();
    env.ADMIN_MASTER_PASSWORD = "";
    await expect(createAdminPasswordSession(env, "test-master-password")).resolves.toBeNull();
    expect(sessions).toHaveLength(0);
  });
});

describe("login code auth", () => {
  it("creates a short-lived code, verifies it once, and creates a client session", async () => {
    const { env, authCodes, sessions } = createAuthTestEnv();

    const requested = await requestLoginCode(env, "CLIENT@EXAMPLE.COM");
    expect(requested.code).toMatch(/^\d{6}$/);
    expect(authCodes[0].email).toBe("client@example.com");
    expect(authCodes[0].code_hash).not.toBe(requested.code);

    const session = await verifyLoginCode(env, "client@example.com", requested.code);
    expect(session?.role).toBe("client");
    expect(session?.client?.email).toBe("client@example.com");
    expect(sessions).toHaveLength(1);
    expect(authCodes[0].consumed_at).not.toBeNull();

    const reused = await verifyLoginCode(env, "client@example.com", requested.code);
    expect(reused).toBeNull();
  });

  it("creates admin sessions for configured admin emails", async () => {
    const { env } = createAuthTestEnv();
    const requested = await requestLoginCode(env, "admin@beyondfreedomfinancial.com");

    const session = await verifyLoginCode(env, "admin@beyondfreedomfinancial.com", requested.code);
    expect(session?.role).toBe("admin");
    expect(session?.adminEmail).toBe("admin@beyondfreedomfinancial.com");
    expect(session?.client).toBeNull();
  });

  it("rejects expired codes", async () => {
    const { env, authCodes } = createAuthTestEnv();
    const code = "123456";
    authCodes.push({
      id: "code_expired",
      tenant_id: "tenant_beyond_freedom",
      email: "client@example.com",
      code_hash: await sha256(code),
      expires_at: "2000-01-01T00:00:00.000Z",
      consumed_at: null,
      created_at: "2000-01-01T00:00:00.000Z"
    });

    const session = await verifyLoginCode(env, "client@example.com", code);
    expect(session).toBeNull();
    expect(authCodes[0].consumed_at).toBeNull();
  });

  it("does not self-create unknown production clients", async () => {
    const { env, clients } = createAuthTestEnv();
    env.ENVIRONMENT = "production";
    clients.delete("client@example.com");
    const requested = await requestLoginCode(env, "client@example.com");

    const session = await verifyLoginCode(env, "client@example.com", requested.code);

    expect(session).toBeNull();
    expect(clients.has("client@example.com")).toBe(false);
  });
});
