import type { IncomingHttpHeaders } from 'node:http';

export interface CachedResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  expiresAt: number;
}

/**
 * Tiny in-memory TTL cache used to cache the Product Service `getProductsList`
 * response at the BFF level. Single-instance (`--single`) EB deployment, so a
 * process-local Map is sufficient.
 */
const store = new Map<string, CachedResponse>();

export function getCached(key: string): CachedResponse | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

export function setCached(
  key: string,
  status: number,
  headers: IncomingHttpHeaders,
  body: Buffer,
  ttlMs: number,
): void {
  store.set(key, { status, headers, body, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}
