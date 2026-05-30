import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressFor, readStorage, writeStorage } from "./storage";

// In-memory localStorage stub so these stay deterministic in the node test env.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    }
  } as Storage;
}

describe("storage", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips a JSON value", () => {
    writeStorage("k", { a: 1, b: ["x"] });
    expect(readStorage("k", null)).toEqual({ a: 1, b: ["x"] });
  });

  it("returns the fallback for a missing key", () => {
    expect(readStorage("missing", "fallback")).toBe("fallback");
  });

  it("returns the fallback for malformed JSON rather than throwing", () => {
    localStorage.setItem("bad", "{not valid json");
    expect(readStorage("bad", 0)).toBe(0);
  });

  it("reads lesson reading-progress per slug", () => {
    expect(progressFor("intro")).toBe(0);
    writeStorage("learn-progress:intro", 42);
    expect(progressFor("intro")).toBe(42);
  });
});
