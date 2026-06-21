# BFF Service

Backend For Frontend that proxies incoming requests to the appropriate
downstream service (Product Service or Cart Service) based on the first path
segment and the service mappings in `.env`.

Built on Node's native `http`/`https` modules — **no Express** (RS School `-50` penalty).

## How it works

```
{bff-url}/{recipient-service-name}/{rest-of-path}?query
```

1. `{recipient-service-name}` is the first path segment (e.g. `product`, `cart`).
2. The recipient base URL is resolved from `.env` using that name as the key.
3. The request method, headers, remaining path, query string and body are
   forwarded to the recipient unchanged.
4. The recipient's response (same status code and body) is streamed back.

Error handling:

- If no recipient URL is found for the name → `502 { "message": "Cannot process request" }`.
- If the recipient returns an error, the BFF returns the **same** status code and body.

## Configuration (`.env`)

```
PORT=3000
product=https://<product-service-api>/prod
cart=http://<cart-service-eb-url>
```

Copy `.env.example` to `.env` and adjust the URLs.

## Run locally

```bash
npm install
npm run dev        # ts-node, no build step
# or
npm run build && npm start
```

## Examples

```bash
# Product Service via BFF
curl http://localhost:3000/product/products

# Cart Service via BFF (Basic auth forwarded)
curl http://localhost:3000/cart/api/profile/cart \
  -H "Authorization: Basic <token>"

# Unknown service -> 502
curl -i http://localhost:3000/unknown
```
