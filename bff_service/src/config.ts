import 'dotenv/config';

export interface BffConfig {
  port: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  /** Rest path (after the service name) whose GET response is cached. */
  cacheRestPath: string;
}

export function getConfig(): BffConfig {
  return {
    port: Number(process.env.PORT) || 3000,
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 2 * 60 * 1000, // 2 minutes
    cacheRestPath: process.env.CACHE_REST_PATH || 'products',
  };
}

/**
 * Resolves the target service base URL from the environment using the
 * recipient service name (first path segment) as the key.
 *
 * Lookup order:
 *   1. process.env[name]            e.g. `cart`
 *   2. process.env[name.toUpperCase()]  e.g. `CART`
 *
 * Reserved names (PORT) are never treated as service mappings.
 */
const RESERVED_KEYS = new Set(['PORT']);

export function resolveRecipientUrl(serviceName: string): string | undefined {
  if (!serviceName || RESERVED_KEYS.has(serviceName.toUpperCase())) {
    return undefined;
  }

  const direct = process.env[serviceName];
  if (direct) return direct;

  const upper = process.env[serviceName.toUpperCase()];
  if (upper) return upper;

  return undefined;
}
