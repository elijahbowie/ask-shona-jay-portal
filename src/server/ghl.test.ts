import { afterEach, describe, expect, it, vi } from "vitest";
import { applyGhlWebhook, createGhlContact, sendGhlEscalation, verifyGhlWebhook } from "./ghl";
import { sha256 } from "./crypto";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

interface StoredClient {
  email: string;
  name: string;
  tier: string;
  ghlContactId: string | null;
  lifecycleStage: string;
  tagsJson: string;
  hasChildren: number;
}

function createGhlTestEnv() {
  const webhookEvents = new Set<string>();
  const clients = new Map<string, StoredClient>();
  const calls: string[] = [];

  const env = {
    ENVIRONMENT: "production",
    GHL_WEBHOOK_SECRET: "test-secret",
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          first: async () => {
            if (sql.includes("FROM webhook_events")) {
              const externalId = String(binds[1]);
              return webhookEvents.has(externalId) ? { id: externalId } : null;
            }
            if (sql.includes("FROM client_profiles")) {
              const email = String(binds[1]);
              const client = clients.get(email);
              return client ? { id: email } : null;
            }
            return null;
          },
          run: async () => {
            calls.push(sql);
            if (sql.includes("INSERT INTO webhook_events")) {
              webhookEvents.add(String(binds[3]));
            }
            if (sql.includes("INSERT INTO client_profiles")) {
              clients.set(String(binds[2]), {
                email: String(binds[2]),
                name: String(binds[3]),
                ghlContactId: binds[4] ? String(binds[4]) : null,
                tier: String(binds[5]),
                lifecycleStage: String(binds[7]),
                tagsJson: String(binds[8]),
                hasChildren: Number(binds[9])
              });
            }
            if (sql.includes("UPDATE client_profiles")) {
              const existingEmail = String(binds[6]);
              const current = clients.get(existingEmail);
              if (current) {
                current.name = String(binds[0]);
                current.ghlContactId = binds[1] ? String(binds[1]) : null;
                current.tier = String(binds[2]);
                current.lifecycleStage = String(binds[3]);
                current.tagsJson = String(binds[4]);
              }
            }
            return { success: true };
          }
        })
      })
    }
  } as unknown as Env;

  return { env, clients, calls };
}

describe("verifyGhlWebhook", () => {
  it("rejects unsigned production webhooks", async () => {
    const ok = await verifyGhlWebhook({ ENVIRONMENT: "production", GHL_WEBHOOK_SECRET: "secret" } as Env, "{}", null);
    expect(ok).toBe(false);
  });

  it("accepts a valid production webhook signature", async () => {
    const body = JSON.stringify({ eventId: "evt_1" });
    const signature = await sha256(`secret.${body}`);
    const ok = await verifyGhlWebhook({ ENVIRONMENT: "production", GHL_WEBHOOK_SECRET: "secret" } as Env, body, signature);
    expect(ok).toBe(true);
  });

  it("allows unsigned development webhooks when no secret is configured", async () => {
    const ok = await verifyGhlWebhook({ ENVIRONMENT: "development" } as Env, "{}", null);
    expect(ok).toBe(true);
  });
});

describe("applyGhlWebhook", () => {
  it("syncs allowed contact fields and ignores duplicate webhook events", async () => {
    const { env, clients, calls } = createGhlTestEnv();
    const payload = {
      eventId: "evt_123",
      contactId: "contact_123",
      email: "Client@Example.com",
      firstName: "Jane",
      lastName: "Founder",
      lifecycleStage: "onboarding",
      tags: ["hire-kids", "high", "untrusted-tag"]
    };

    await applyGhlWebhook(env, payload);
    await applyGhlWebhook(env, payload);

    const client = clients.get("client@example.com");
    expect(client).toMatchObject({
      name: "Jane Founder",
      ghlContactId: "contact_123",
      tier: "high",
      lifecycleStage: "onboarding",
      hasChildren: 1
    });
    expect(JSON.parse(client?.tagsJson || "[]")).toEqual(["hire-kids", "high"]);
    expect(calls.filter((sql) => sql.includes("INSERT INTO webhook_events"))).toHaveLength(1);
    expect(calls.filter((sql) => sql.includes("INSERT INTO client_profiles"))).toHaveLength(1);
  });
});

describe("createGhlContact", () => {
  it("returns an existing contact instead of creating a duplicate", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ contact: { id: "contact_existing" } }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createGhlContact(
      {
        GHL_ENABLED: "true",
        GHL_API_KEY: "ghl_test",
        GHL_LOCATION_ID: "location_123"
      } as Env,
      {
        email: "Client@Example.com",
        firstName: "Client",
        lastName: "Example"
      }
    );

    expect(result).toEqual({ contactId: "contact_existing", created: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=location_123&email=client%40example.com",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("creates a contact when no exact email match exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contact: { id: "contact_created" } }), { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createGhlContact(
      {
        GHL_ENABLED: "true",
        GHL_API_KEY: "ghl_test",
        GHL_LOCATION_ID: "location_123"
      } as Env,
      {
        email: "Client@Example.com",
        firstName: "Client",
        lastName: "Example",
        source: "Portal preview"
      }
    );

    expect(result).toEqual({ contactId: "contact_created", created: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://services.leadconnectorhq.com/contacts/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ghl_test",
          Version: "2021-07-28",
          "Content-Type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(JSON.parse(String(calls[1][1].body))).toMatchObject({
      locationId: "location_123",
      email: "client@example.com",
      firstName: "Client",
      lastName: "Example",
      source: "Portal preview"
    });
  });
});

describe("sendGhlEscalation", () => {
  it("does not call GoHighLevel when integration secrets are not configured", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const taskId = await sendGhlEscalation({ GHL_ENABLED: "true" } as Env, {
      clientEmail: "client@example.com",
      summary: "Needs review",
      portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_1"
    });

    expect(taskId).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a GoHighLevel task when configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ task: { id: "task_123" } }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const taskId = await sendGhlEscalation(
      {
        GHL_ENABLED: "true",
        GHL_API_KEY: "ghl_test",
        GHL_LOCATION_ID: "location_123"
      } as Env,
      {
        clientEmail: "client@example.com",
        summary: "Needs review",
        portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_1"
      }
    );

    expect(taskId).toBe("task_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/tasks/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ghl_test",
          Version: "2021-07-28",
          "Content-Type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const body = JSON.parse(String(calls[0][1].body));
    expect(body).toMatchObject({
      locationId: "location_123",
      title: "Ask Advisor escalation for client@example.com"
    });
    expect(body.body).toContain("Needs review");
    expect(body.body).toContain("https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_1");
  });

  it("throws on GoHighLevel task failures so queue retry can handle them", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bad", { status: 429 })) as unknown as typeof fetch;

    await expect(
      sendGhlEscalation(
        {
          GHL_ENABLED: "true",
          GHL_API_KEY: "ghl_test",
          GHL_LOCATION_ID: "location_123"
        } as Env,
        {
          clientEmail: "client@example.com",
          summary: "Needs review",
          portalUrl: "https://ask.beyondfreedomfinancial.com/admin/questions?escalation=esc_1"
        }
      )
    ).rejects.toThrow("GoHighLevel escalation failed with 429");
  });
});
