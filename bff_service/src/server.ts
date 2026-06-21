import http, { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { getConfig, resolveRecipientUrl } from './config.js';
import { getCached, setCached } from './cache.js';

const config = getConfig();

/**
 * Reads the full request body into a single Buffer.
 */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

/**
 * Builds the recipient target URL.
 *   incoming  /cart/api/profile/cart?foo=1
 *   service   cart            -> recipientUrl (from env)
 *   forwarded /api/profile/cart?foo=1 appended to recipientUrl
 */
function buildTargetUrl(recipientUrl: string, segments: string[], query: string): URL {
  const base = recipientUrl.replace(/\/+$/, '');
  const restPath = segments.slice(1).join('/');
  const path = restPath ? `/${restPath}` : '';
  return new URL(`${base}${path}${query ? `?${query}` : ''}`);
}

interface CacheOptions {
  key: string;
  ttlMs: number;
}

/**
 * Forwards the original request to the resolved recipient service, preserving
 * method, headers, query string and body, and returns the recipient response
 * unchanged (same status code and body).
 *
 * When `cache` is provided, the response is buffered and a successful (2xx)
 * response is stored in the cache; otherwise the response is streamed.
 */
async function forward(
  req: IncomingMessage,
  res: ServerResponse,
  target: URL,
  cache?: CacheOptions,
): Promise<void> {
  const body = await readBody(req);

  // Clone headers and drop the Host header so the client library sets the
  // correct one for the recipient host.
  const headers: Record<string, string | string[] | undefined> = { ...req.headers };
  delete headers.host;

  const client = target.protocol === 'https:' ? https : http;

  const proxyReq = client.request(
    target,
    { method: req.method, headers },
    (proxyRes) => {
      const status = proxyRes.statusCode ?? 502;

      if (!cache) {
        // Stream the recipient response straight back to the caller.
        res.writeHead(status, proxyRes.headers);
        proxyRes.pipe(res);
        return;
      }

      // Buffer the response so it can be cached.
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        const respBody = Buffer.concat(chunks);
        if (status >= 200 && status < 300) {
          setCached(cache.key, status, proxyRes.headers, respBody, cache.ttlMs);
        }
        res.writeHead(status, { ...proxyRes.headers, 'x-bff-cache': 'MISS' });
        res.end(respBody);
      });
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      sendJson(res, 502, { message: 'Cannot process request' });
    } else {
      res.end();
    }
  });

  if (body.length > 0) {
    proxyReq.write(body);
  }
  proxyReq.end();
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = req.url ?? '/';
  const [rawPath, rawQuery = ''] = rawUrl.split('?');
  const segments = rawPath.split('/').filter(Boolean);

  const recipientServiceName = segments[0];
  const recipientUrl = recipientServiceName
    ? resolveRecipientUrl(recipientServiceName)
    : undefined;

  // No mapping for the requested service name -> 502.
  if (!recipientUrl) {
    sendJson(res, 502, { message: 'Cannot process request' });
    return;
  }

  const target = buildTargetUrl(recipientUrl, segments, rawQuery);

  // Cache only the products list (getProductsList) GET request.
  const restPath = segments.slice(1).join('/');
  const isCacheable =
    config.cacheEnabled &&
    req.method === 'GET' &&
    restPath === config.cacheRestPath;

  if (isCacheable) {
    const cacheKey = `GET ${rawUrl}`;
    const hit = getCached(cacheKey);
    if (hit) {
      res.writeHead(hit.status, { ...hit.headers, 'x-bff-cache': 'HIT' });
      res.end(hit.body);
      return;
    }

    try {
      await forward(req, res, target, { key: cacheKey, ttlMs: config.cacheTtlMs });
    } catch {
      if (!res.headersSent) {
        sendJson(res, 502, { message: 'Cannot process request' });
      } else {
        res.end();
      }
    }
    return;
  }

  try {
    await forward(req, res, target);
  } catch {
    if (!res.headersSent) {
      sendJson(res, 502, { message: 'Cannot process request' });
    } else {
      res.end();
    }
  }
}
