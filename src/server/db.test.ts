import { describe, expect, it } from "vitest";
import { recordAuditEvent } from "./db";

// Capture the SQL + bind array that recordAuditEvent sends to D1, so we can pin
// the column→bind order the helper exists to protect (run()'s variadic signature
// cannot type-check it).
function captureEnv() {
  const calls: { sql: string; binds: unknown[] }[] = [];
  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            return {
              run: async () => {
                calls.push({ sql, binds });
                return {};
              }
            };
          }
        };
      }
    }
  } as unknown as Env;
  return { env, calls };
}

describe("recordAuditEvent", () => {
  it("binds columns in the declared order", async () => {
    const { env, calls } = captureEnv();
    await recordAuditEvent(env, {
      actor: "client@example.com",
      action: "auth.request_code",
      targetType: "auth_code",
      targetId: "client@example.com",
      metadata: { expiresAt: "2026-01-01" }
    });
    expect(calls).toHaveLength(1);
    const { sql, binds } = calls[0];
    expect(sql).toContain("INSERT INTO audit_events");
    // columns: id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at
    expect(binds).toHaveLength(8);
    expect(typeof binds[0]).toBe("string"); // generated id
    expect(binds[2]).toBe("client@example.com"); // actor
    expect(binds[3]).toBe("auth.request_code"); // action
    expect(binds[4]).toBe("auth_code"); // target_type
    expect(binds[5]).toBe("client@example.com"); // target_id
    expect(binds[6]).toBe(JSON.stringify({ expiresAt: "2026-01-01" })); // metadata_json
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const { env, calls } = captureEnv();
    await recordAuditEvent(env, {
      actor: "system",
      action: "health.run",
      targetType: "health",
      targetId: "health_run"
    });
    expect(calls[0].binds[6]).toBe("{}");
  });

  it("uses the provided timestamp when given", async () => {
    const { env, calls } = captureEnv();
    const at = "2026-01-02T03:04:05.000Z";
    await recordAuditEvent(env, {
      actor: "system",
      action: "wiki.publish",
      targetType: "wiki_page",
      targetId: "wiki_1",
      at
    });
    expect(calls[0].binds[7]).toBe(at);
  });
});
