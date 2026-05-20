import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyGhlEscalation } from "./escalations";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function createEscalationNotifyEnv() {
  const updates: unknown[][] = [];
  const queueMessages: unknown[] = [];
  const env = {
    GHL_ENABLED: "true",
    GHL_API_KEY: "ghl_test",
    GHL_LOCATION_ID: "location_123",
    GHL_RETRY_QUEUE: {
      send: async (message: unknown) => {
        queueMessages.push(message);
      }
    },
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          run: async () => {
            if (sql.includes("UPDATE escalations SET ghl_task_id")) {
              updates.push(binds);
            }
            return { success: true };
          }
        })
      })
    }
  } as unknown as Env;
  return { env, updates, queueMessages };
}

describe("notifyGhlEscalation", () => {
  it("creates a GoHighLevel task and records the task id on the escalation", async () => {
    const { env, updates, queueMessages } = createEscalationNotifyEnv();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "task_123" }), { status: 200 })) as unknown as typeof fetch;

    const result = await notifyGhlEscalation(env, {
      escalationId: "esc_123",
      clientEmail: "client@example.com",
      summary: "Explicit escalation from the client",
      portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_123"
    });

    expect(result).toEqual({ ghlTaskId: "task_123", queuedForRetry: false });
    expect(updates).toHaveLength(1);
    expect(updates[0][0]).toBe("task_123");
    expect(updates[0][2]).toBe("esc_123");
    expect(queueMessages).toHaveLength(0);
  });

  it("queues the escalation for retry when GoHighLevel rejects the task request", async () => {
    const { env, updates, queueMessages } = createEscalationNotifyEnv();
    globalThis.fetch = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;

    const result = await notifyGhlEscalation(env, {
      escalationId: "esc_retry",
      clientEmail: "client@example.com",
      summary: "Needs review",
      portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_retry"
    });

    expect(result).toEqual({ ghlTaskId: null, queuedForRetry: true });
    expect(updates).toHaveLength(0);
    expect(queueMessages).toEqual([
      {
        escalationId: "esc_retry",
        clientEmail: "client@example.com",
        summary: "Needs review",
        portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_retry"
      }
    ]);
  });
});
