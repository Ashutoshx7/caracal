# identity/ts

## Scope
- Covers only the `@caracalai/identity` TS package under `packages/identity/ts/`.

## Required
- Must implement JWT verification, JWKS fetch and cache, scope evaluation, and typed claim shapes only.
- Must depend only on `@caracalai/core` and `jose`.

## Forbidden
- Must not import any transport, framework, runtime, storage backend, or `caracalEnterprise/` code.
- Must not reference MCP, FastMCP, net/http, Postgres, or Cloudflare.
