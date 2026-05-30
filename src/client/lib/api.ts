import type { ApiError } from "./types";

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as ApiError).error === "string";
}

/** Fetch JSON from the same-origin API, sending credentials and surfacing API errors. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as T | ApiError;
  if (!response.ok) {
    throw new Error(isApiError(data) ? data.error : `Request failed with ${response.status}`);
  }
  return data as T;
}
