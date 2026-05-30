import { afterEach, describe, expect, it, vi } from "vitest";
import { api, isApiError } from "./api";

describe("isApiError", () => {
  it("detects the API error shape", () => {
    expect(isApiError({ error: "nope" })).toBe(true);
    expect(isApiError({})).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("error")).toBe(false);
  });
});

describe("api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed JSON on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    );
    await expect(api("/api/me")).resolves.toEqual({ ok: true });
  });

  it("throws the server-provided error message on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { "Content-Type": "application/json" } }))
    );
    await expect(api("/api/x")).rejects.toThrow("bad request");
  });

  it("falls back to a status message when the error body has no error field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    await expect(api("/api/x")).rejects.toThrow("503");
  });

  it("sends credentials and a JSON content-type", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await api("/api/chat", { method: "POST", body: "{}" });
    expect(spy).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" })
      })
    );
  });

  it("lets caller-supplied headers merge over the defaults", async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await api("/api/x", { headers: { "X-Test": "1" } });
    const init = spy.mock.calls[0][1] as RequestInit;
    const passedHeaders = init.headers as Record<string, string>;
    expect(passedHeaders["Content-Type"]).toBe("application/json");
    expect(passedHeaders["X-Test"]).toBe("1");
  });
});
