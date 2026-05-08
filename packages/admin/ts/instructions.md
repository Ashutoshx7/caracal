# admin/ts

## Scope
- Covers only the `@caracalai/admin` TS package under `packages/admin/ts/`.

## Required
- Must export a single `AdminClient` typed wrapper over the Caracal admin API (`/v1/*`) and the agent coordinator API.
- Must take `apiUrl`, `coordinatorUrl`, and tokens via the constructor.
- Must use the platform `fetch`.
- Must surface non-2xx responses as `AdminApiError` with `status`, `code`, and `body`.
- Must remain framework-agnostic and consumable from CLI, scripts, and tests.

## Forbidden
- Must not read environment variables or disk state.
- Must not embed credentials.
- Must not introduce schema validation libraries; types are TypeScript-only.
- Must not pull in heavy HTTP dependencies.
