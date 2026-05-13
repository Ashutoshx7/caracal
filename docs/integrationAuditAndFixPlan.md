"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Integration audit findings and the platform fix plan derived from real end-user adoption.
"""

# Caracal Integration Audit & Fix Plan

This document captures friction points discovered while wiring Caracal into a
real third-party application (`examples/lynxCapital`). Every issue here is
**platform-level** — it affects any integrator, not just Lynx Capital. Each
entry includes the recommended fix and where the change belongs.

The companion document for Lynx-specific notes is `examples/lynxCapital/BUGS.md`.

---

## 1. SDK surface (Python / Go / TypeScript)

### 1.1 No atomic `spawn + delegate` primitive  *(high)*
- **Why it matters.** Real fan-out workflows dispatch child agents through
  `asyncio.create_task` (Python), goroutines (Go), or queue jobs. The parent
  has no natural point to call `delegate(to=child_id)` after the child
  reports its `agent_session_id`. The current two-step shape forces either
  blocking the parent (defeating async) or pre-creating sessions (no SDK
  entry point for binding to an existing session).
- **Root cause.** `spawn()` and `delegate()` are independent primitives
  optimized for nested synchronous parent→child flow.
- **Fix.** Add `spawn_and_delegate(kind, scopes, …)` to all three SDKs.
  Single coordinator round-trip: creates the child session, records the
  delegation edge from the calling identity, returns a context already bound
  to the new identity. The async-task pattern then becomes:
  ```python
  async with caracal.spawn_and_delegate(kind="worker", scopes=[...]) as ctx:
      ...
  ```
- **Location.** `packages/sdk/python/caracalai_sdk/primitives.py`,
  `packages/sdk/go/primitives.go`, `packages/sdk/ts/src/primitives.ts`,
  plus a new coordinator endpoint that does both writes atomically.

### 1.2 Envelope is HTTP-centric; no first-class gRPC / MCP / queue carriers  *(high)*
- **Why it matters.** Caracal envelope rides on HTTP headers. Any integrator
  with gRPC services, websockets, SSE, MCP servers, or queue workers must
  hand-extract context and re-inject into a different carrier. The Go SDK
  already has `envelope.ToMap/FromMap`; Python and TS do not.
- **Root cause.** Codec was designed for the HTTP middleware case; pluggable
  carriers were never abstracted.
- **Fix.** Per language, expose: `to_map/from_map`, `to_grpc_metadata/from_grpc_metadata`,
  `to_mcp_meta/from_mcp_meta`. Build all of them on a single in-memory
  `Envelope` type. Provide a gRPC server interceptor and a gRPC client
  interceptor in each SDK that wire context end-to-end.
- **Location.** `packages/sdk/{python,go,ts}/envelope.*`, plus
  `packages/sdk/{python,go,ts}/grpc.*` (new).

### 1.3 TypeScript SDK is missing `transport()` and `syncTransport()`  *(high)*
- **Why it matters.** Python and (effectively) Go integrators get an
  auto-injecting client. TS integrators must call `headers()` on every
  fetch. This makes the TS path materially worse for adoption.
- **Root cause.** TS SDK is feature-behind; `Transport()` was sketched but
  never implemented.
- **Fix.** Implement a `transport()` helper returning a fetch wrapper that
  (a) auto-injects envelope headers, (b) rewrites resource-bound URLs
  through the gateway. Export from `packages/sdk/ts/src/index.ts`.
- **Location.** `packages/sdk/ts/src/client.ts` + `transport.ts` (new).

### 1.4 `CoordinatorClient` has no lifecycle / `close()`  *(medium)*
- **Why it matters.** Python SDK lazily creates one `httpx.AsyncClient` in
  `CoordinatorClient._http()` and never closes it. Long-running apps that
  reload, hot-restart, or run many test cases leak connections. Same issue
  in Go and TS.
- **Root cause.** SDK was prototyped for one-shot scripts.
- **Fix.** Add `Caracal.close()` (Python `async`, Go method, TS async
  function) that closes the underlying HTTP client(s). Call into it from
  the ASGI `shutdown` event and document the pattern.
- **Location.** `packages/sdk/python/caracalai_sdk/client.py` + `coordinator.py`,
  parity in Go/TS.

### 1.5 ASGI middleware install rules are not enforced or documented in code  *(medium)*
- **Why it matters.** `app.add_middleware(...)` must run at module load — it
  silently no-ops if called inside `lifespan`. Integrators waste an
  afternoon on this. *(FIXED in docstring during Lynx integration; raise it
  here as a platform concern.)*
- **Fix.** Keep the docstring fix; additionally make `Caracal.middleware()`
  emit a one-time warning if invoked after `Starlette.router.startup` has
  fired, with a remediation link.
- **Location.** `packages/sdk/python/caracalai_sdk/http.py`.

### 1.6 SDK does not validate `subject_token` before first use  *(medium)*
- **Why it matters.** A misconfigured token (wrong `aud`, expired, signed
  by a non-trusted STS) fails opaquely on first coordinator call. There is
  no "is this token even plausibly correct?" check at `from_env()` time.
- **Root cause.** SDK is content-agnostic; trusts coordinator to reject bad
  tokens.
- **Fix.** Parse the JWT locally (no signature check), assert `exp` in
  future, assert `aud` matches configured `application_id` or coordinator
  URL, surface a clear error from `from_env()` if not.
- **Location.** `packages/sdk/python/caracalai_sdk/client.py` (`from_env`),
  parity in Go/TS.

### 1.7 Refresh / step-up flows exist in STS but no SDK primitives expose them  *(medium)*
- **Why it matters.** Long-lived agents must either re-spawn (expensive,
  loses lineage) or get 401s. STS has `/v1/refresh` and `/v1/stepup`
  handlers; SDKs cannot reach them.
- **Fix.** Add `Caracal.refresh_token()` and `Caracal.stepup(reason)` in
  all three SDKs. Bake refresh into the auth flow: on 401 from gateway,
  refresh once and retry.
- **Location.** SDK clients + STS client glue.

### 1.8 Cross-language naming and shape parity is undocumented  *(low)*
- **Why it matters.** Python `agent_session_id` ↔ Go `AgentSessionID` ↔ TS
  `agentSessionId`. Wire format is snake_case. Multi-language teams hit
  this constantly.
- **Fix.** Add a "Cross-language mapping" table to `packages/sdk/README.md`
  and keep it CI-checked against a shared schema (`packages/sdk/schema.json`).
- **Location.** `packages/sdk/README.md`, plus a small schema-parity test.

---

## 2. Coordinator

### 2.1 Spawn is not idempotent  *(medium)*
- **Why it matters.** If the coordinator response is lost mid-flight (network
  blip, restart), the SDK retries and creates a second `agent_session`.
  This pollutes the session graph and double-counts quotas.
- **Fix.** Accept an `Idempotency-Key` header on `POST /v1/sessions/spawn`;
  return the existing session if the key was seen within a TTL window.
  Standard idempotency-store pattern (key + request-hash → response).
- **Location.** `apps/coordinator/internal/sessions/spawn.go` (+ tests).

### 2.2 No bulk-delegate endpoint  *(medium)*
- **Why it matters.** Fan-out workflows produce N delegations; each is one
  HTTP round-trip. For five regional orchestrators, that's five sequential
  calls during startup.
- **Fix.** Add `POST /v1/delegations:batch` accepting an array of edges,
  returning per-item status. Reuse single-edge validation.
- **Location.** `apps/coordinator/internal/delegations`.

---

## 3. Gateway

### 3.1 Resource binding match is first-hit, not longest-prefix  *(high)*
- **Why it matters.** Configure `r1=https://api.example.com/` and
  `r2=https://api.example.com/v1` — whichever loads first wins for
  `/v1/users`. Routing depends on map iteration order. Silent misroute.
- **Fix.** Sort bindings by `len(upstream_prefix)` descending at load time;
  match longest-prefix-first. Add a startup log warning when prefixes
  overlap.
- **Location.** `services/gateway/internal/bindings.go`.

### 3.2 SSRF guard coverage is asserted in `instructions.md` but not test-covered  *(high)*
- **Why it matters.** `gateway/instructions.md` requires `SafeDialContext`
  on every upstream dial. There is no integration test that binds a
  resource to `127.0.0.1` / `169.254.169.254` / `::1` and asserts the dial
  is refused.
- **Fix.** Add explicit deny-by-default tests: loopback, link-local,
  metadata-service, RFC1918 (unless `ALLOW_PRIVATE_UPSTREAMS=true`),
  AAAA-record private ranges. Confirm `SafeDialContext` is wired in the
  actual `http.Transport` constructed by `proxy.go`.
- **Location.** `services/gateway/internal/{proxy,safety,bindings}_test.go`.

### 3.3 No structured error body on 4xx/5xx  *(medium)*
- **Why it matters.** A 403 from the gateway returns either an empty body or
  a free-form message. Integrators can't programmatically distinguish
  "resource not bound" from "policy denied" from "upstream unreachable".
- **Fix.** Return a stable JSON shape:
  `{"error":"resource_not_bound","resource":"mercury","trace_id":"…"}`.
  Document the enum of error codes.
- **Location.** `services/gateway/internal/errors.go` (new).

### 3.4 Bindings are not hot-reloaded  *(medium)*
- **Why it matters.** Adding a new resource requires a gateway restart.
  In production this means scheduled downtime per provider added.
- **Fix.** Watch the bindings source (file or coordinator endpoint) and
  swap atomically on change. Emit a log on reload.
- **Location.** `services/gateway/internal/config.go`.

---

## 4. STS

### 4.1 No documented clock-skew tolerance  *(medium)*
- **Why it matters.** STS issues short-lived JWTs (`exp`, `iat`, `nbf`).
  Air-gapped or NTP-less clients get cryptic "token expired" errors when
  drift is >0 seconds.
- **Fix.** Accept ±60 s drift by default on `iat`/`nbf`, document the
  setting (`STS_LEEWAY_SECONDS`), surface it in gateway error messages.
- **Location.** `services/sts/internal/issue.go`, `services/gateway/internal/verify.go`.

### 4.2 JWKS rotation has no client-visible cache directive  *(medium)*
- **Why it matters.** Gateways and SDKs fetch JWKS; on key rotation,
  cached keys serve stale-verify until next fetch. No `Cache-Control` or
  `kid`-driven refresh.
- **Fix.** Emit `Cache-Control: max-age=300, must-revalidate` on JWKS
  responses; on signature verification failure, force a one-time JWKS
  refresh keyed by `kid`.
- **Location.** `services/sts/internal/jwks.go`.

---

## 5. Audit

### 5.1 Service is "implementation in progress" in `docs/NOTE.md`  *(high)*
- **Why it matters.** Audit is the compliance story. An incomplete audit
  service blocks regulated-industry adoption — exactly the buyers the
  enterprise package targets.
- **Fix.** Land the remaining handlers, freeze the event schema, publish a
  schema doc, remove the "in progress" warning. Mark "tech preview" until
  the schema is frozen.
- **Location.** `services/audit/*`, `docs/src/content/docs/audit/*`.

---

## 6. Connectors

### 6.1 No "write your own connector" skeleton  *(medium)*
- **Why it matters.** Real integrators have proprietary providers. There
  is no documented contract (`Connector` interface, lifecycle hooks,
  config shape) and no starter template.
- **Fix.** Document the connector contract; ship a `cookiecutter`-style
  starter under `packages/connectors/_template/` plus a one-page guide.
- **Location.** `packages/connectors/instructions.md`, new template.

---

## 7. CLI / TUI

### 7.1 `caracal init` writes config without probing the coordinator  *(low)*
- **Why it matters.** Bad URL is captured silently; failures come later
  with opaque "connection refused".
- **Fix.** Probe `GET /readyz` before writing `caracal.toml`; refuse to
  init unless the user passes `--force`.

### 7.2 No `caracal generate-secrets` for the compose bootstrap  *(low)*
- **Why it matters.** Users must hand-run `openssl rand -hex 32` three
  times (`ZONE_KEK`, `AUDIT_HMAC_KEY`, `STREAMS_HMAC_KEY`). Easy to skip
  and end up with an insecure dev stack.
- **Fix.** `caracal generate-secrets > .env.local` writes a complete
  block. Wire into `caracal up` to auto-generate if missing.

### 7.3 TUI validates required env lazily, not on startup  *(low)*
- **Why it matters.** Missing `CARACAL_COORDINATOR_TOKEN` crashes when the
  user opens the agents view instead of failing on launch.
- **Fix.** Startup-time check; status banner on the dashboard.

---

## 8. Packaging & Docs

### 8.1 Compose stack is dev-only with no production guidance  *(medium)*
- **Why it matters.** `infra/docker/docker-compose.yml` binds everything
  to `127.0.0.1`. K8s users have no Helm chart or sample manifest.
- **Fix.** Ship a minimal Helm chart under `infra/helm/caracal/` and a
  `docker-compose.prod.yml` overlay that uses service DNS.

### 8.2 No troubleshooting runbook for gateway 401 / 403 / 5xx  *(medium)*
- **Fix.** Add a single-page "When the gateway says no" runbook covering
  resource-not-bound, STS expired, policy denied, SSRF blocked, upstream
  5xx. Link from the gateway error body's `error` field to the right
  section.

### 8.3 No example for gRPC or MCP context propagation  *(medium)*
- **Why it matters.** Lynx demonstrates HTTP. gRPC and MCP integrators
  have no reference. Tied to issue 1.2.
- **Fix.** Two minimal examples (`examples/grpcEcho`, `examples/mcpEcho`)
  showing context flowing across an interceptor / server hook.

### 8.4 Pin-and-lock guidance is missing from the README  *(low)*
- **Fix.** One-paragraph "Versioning" section: pin to release tags, use
  lockfiles, avoid `latest` Docker tags in production.

---

## Implementation plan

The work is grouped into four shippable tracks. Each track lands behind
its own changeset; nothing here changes wire format incompatibly without
versioning.

### Track A — Async-friendly SDK primitives  (issues 1.1, 1.2, 1.4, 1.7)
1. Land `POST /v1/sessions:spawnAndDelegate` in the coordinator (atomic,
   idempotent). Add tests.
2. Add `spawn_and_delegate` to Python, Go, TS SDKs against the new
   endpoint. Async-task example in `docs/`.
3. Lift `envelope.ToMap/FromMap` semantics into Python and TS. Add
   `to_grpc_metadata/from_grpc_metadata` and gRPC interceptors in all
   three SDKs.
4. Add `Caracal.close()` / `Caracal.refresh_token()` / `Caracal.stepup()`
   to all three SDKs; wire refresh into the transport's 401 retry path.

### Track B — Gateway correctness & observability  (issues 3.1–3.4, 4.1, 4.2)
1. Sort bindings longest-prefix-first; emit overlap warning.
2. Land SSRF deny-by-default tests; confirm `SafeDialContext` wiring.
3. Replace ad-hoc error bodies with the structured error contract; publish
   the enum.
4. Hot-reload bindings (file watcher + coordinator-driven refresh).
5. STS leeway flag, JWKS `Cache-Control`, `kid`-driven refresh on
   verification failure.

### Track C — TypeScript SDK parity  (issue 1.3, 1.8, plus 1.2 carrier work)
1. Implement `transport()` in TS mirroring Python's behavior.
2. Express + Fastify middleware factories.
3. Cross-language mapping table; schema-parity CI check.

### Track D — Audit, connectors, CLI/TUI, docs, packaging  (issues 2, 5, 6, 7, 8)
1. Complete audit service; freeze schema; remove "in progress" notice.
2. Coordinator idempotency-key on spawn; bulk-delegate endpoint.
3. Connector starter template + contract doc.
4. CLI `init` probe, `generate-secrets`, TUI startup checks.
5. Helm chart + production compose overlay.
6. Troubleshooting runbook; gRPC / MCP examples; versioning section.

### Sequencing
- **First wave** (unblocks the most integrators): Track A items 1–3 and
  Track B items 1, 3.
- **Second wave** (closes correctness gaps): Track A item 4, Track B
  items 2, 4, 5, Track C in full.
- **Third wave** (enterprise readiness): Track D in full.

### Definition of done per item
- Code change behind a passing unit + integration test.
- One paragraph added to the relevant `instructions.md` or doc page.
- If the change is user-visible: a line in the changelog and, where
  appropriate, an updated snippet in `examples/lynxCapital`.
