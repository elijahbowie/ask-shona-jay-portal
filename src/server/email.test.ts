import { afterEach, describe, expect, it, vi } from "vitest";
import { sendLoginCodeEmail } from "./email";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("sendLoginCodeEmail", () => {
  it("allows development login without email provider secrets", async () => {
    await expect(
      sendLoginCodeEmail({ ENVIRONMENT: "development" } as Env, {
        email: "client@example.com",
        code: "123456",
        expiresAt: "2026-05-13T12:00:00.000Z"
      })
    ).resolves.toBeUndefined();
  });

  it("fails closed in production when GoHighLevel secrets are missing", async () => {
    await expect(
      sendLoginCodeEmail({ ENVIRONMENT: "production" } as Env, {
        email: "client@example.com",
        code: "123456",
        expiresAt: "2026-05-13T12:00:00.000Z"
      })
    ).rejects.toThrow("Production login requires GHL_API_KEY and GHL_LOCATION_ID secrets.");
  });

  it("sends login codes through GoHighLevel when configured", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://services.leadconnectorhq.com/contacts/search/duplicate")) {
        return new Response(JSON.stringify({ contact: { id: "contact_123" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ messageId: "msg_123" }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await sendLoginCodeEmail(
      {
        ENVIRONMENT: "production",
        GHL_ENABLED: "true",
        GHL_API_KEY: "ghl_test",
        GHL_LOCATION_ID: "location_123"
      } as Env,
      {
        email: "client@example.com",
        code: "654321",
        expiresAt: "2026-05-13T12:00:00.000Z"
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=location_123&email=client%40example.com",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer ghl_test",
          Version: "2021-07-28"
        })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/conversations/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ghl_test",
          Version: "2021-04-15",
          "Content-Type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [, init] = calls[1];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      type: "Email",
      contactId: "contact_123",
      locationId: "location_123",
      emailTo: "client@example.com",
      subject: "Your Ask Advisor login code"
    });
    expect(body.message).toContain("654321");
    expect(body.html).toContain("654321");
  });

  it("fails when the portal email is not a GoHighLevel contact", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not found", { status: 404 })) as typeof fetch;

    await expect(
      sendLoginCodeEmail(
        {
          ENVIRONMENT: "production",
          GHL_ENABLED: "true",
          GHL_API_KEY: "ghl_test",
          GHL_LOCATION_ID: "location_123"
        } as Env,
        {
          email: "client@example.com",
          code: "654321",
          expiresAt: "2026-05-13T12:00:00.000Z"
        }
      )
    ).rejects.toThrow("No matching GoHighLevel contact found for this portal email.");
  });

  it("falls back to legacy GoHighLevel contact search for legacy location API keys", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://services.leadconnectorhq.com/contacts/search/duplicate")) {
        return new Response("unauthorized", { status: 401 });
      }
      if (url.startsWith("https://rest.gohighlevel.com/v1/contacts/")) {
        return new Response(JSON.stringify({ contacts: [{ id: "legacy_contact_123", email: "client@example.com" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ messageId: "msg_123" }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await sendLoginCodeEmail(
      {
        ENVIRONMENT: "production",
        GHL_ENABLED: "true",
        GHL_API_KEY: "legacy_ghl_test",
        GHL_LOCATION_ID: "location_123"
      } as Env,
      {
        email: "client@example.com",
        code: "654321",
        expiresAt: "2026-05-13T12:00:00.000Z"
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://rest.gohighlevel.com/v1/contacts/?query=client%40example.com",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer legacy_ghl_test"
        })
      })
    );
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const body = JSON.parse(String(calls[2][1].body));
    expect(body.contactId).toBe("legacy_contact_123");
  });

  it("explains when a legacy GoHighLevel key cannot send conversation email", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://services.leadconnectorhq.com/contacts/search/duplicate")) {
        return new Response("unauthorized", { status: 401 });
      }
      if (url.startsWith("https://rest.gohighlevel.com/v1/contacts/")) {
        return new Response(JSON.stringify({ contacts: [{ id: "legacy_contact_123", email: "client@example.com" }] }), { status: 200 });
      }
      return new Response("unauthorized", { status: 401 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      sendLoginCodeEmail(
        {
          ENVIRONMENT: "production",
          GHL_ENABLED: "true",
          GHL_API_KEY: "legacy_ghl_test",
          GHL_LOCATION_ID: "location_123"
        } as Env,
        {
          email: "client@example.com",
          code: "654321",
          expiresAt: "2026-05-13T12:00:00.000Z"
        }
      )
    ).rejects.toThrow("GoHighLevel login email requires a v2 Private Integration token");
  });

  it("surfaces GoHighLevel delivery failures", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://services.leadconnectorhq.com/contacts/search/duplicate")) {
        return new Response(JSON.stringify({ contact: { id: "contact_123" } }), { status: 200 });
      }
      return new Response("nope", { status: 403 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      sendLoginCodeEmail(
        {
          ENVIRONMENT: "production",
          GHL_ENABLED: "true",
          GHL_API_KEY: "ghl_test",
          GHL_LOCATION_ID: "location_123"
        } as Env,
        {
          email: "client@example.com",
          code: "654321",
          expiresAt: "2026-05-13T12:00:00.000Z"
        }
      )
    ).rejects.toThrow("GoHighLevel login email failed with 403");
  });
});
