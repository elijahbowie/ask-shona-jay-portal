/** Read + parse a JSON value from localStorage, falling back on any error. */
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Reading progress (0–100) for a lesson, persisted per slug on this device. */
export function progressFor(slug: string): number {
  return readStorage<number>(`learn-progress:${slug}`, 0);
}
