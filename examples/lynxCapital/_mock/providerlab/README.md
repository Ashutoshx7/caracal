<!--
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Operator guide for the LynxCapital provider mock lab.
-->

# Provider mock lab

A self-contained set of mock external providers, two for every Caracal provider
auth category, each served on its own `localhost` port. The lab exists so the
LynxCapital app and the upcoming Caracal SDK integration can be exercised against
realistic third-party boundaries without touching any real vendor.

Everything here lives under `_mock/` and never leaks into `app/`.

## Taxonomy

Sixteen providers, two per category, ports `9400`–`9415`:

| Category | Providers | Ports | Boundary behavior |
| --- | --- | --- | --- |
| `api_key` | Aurum Pay, Quill OCR | 9400, 9401 | API key in header vs. query |
| `bearer_token` | Nimbus Ledger, Vela Mail | 9402, 9403 | standard vs. custom header/scheme |
| `oauth2_client_credentials` | Helios FX, Orbit ERP | 9404, 9405 | `client_secret_basic` vs. `client_secret_post` + audience |
| `oauth2_authorization_code` | Corvus Bank, Lumen CRM | 9406, 9407 | PKCE vs. offline refresh tokens |
| `caracal_mandate` | Atlas Treasury, Sentinel Compliance | 9408, 9409 | verifier-SDK semantics; second requires delegation |
| `none` (internal) | Core Billing, Core Identity | 9410, 9411 | behind the boundary, no upstream credential |
| `mcp` | Forge Tools, Relay | 9412, 9413 | bearer-guarded vs. mandate-guarded JSON-RPC |
| `sdk` | Zephyr Pay, Terra Tax | 9414, 9415 | HTTP provider behind a pip-installable SDK shim |

Wire field names deliberately use third-party industry shapes (`clientId`,
`clientSecret`, `apiKey`, `accessToken`) and never Caracal-internal naming, so the
providers look and behave like real outside services.

## Running

All providers in one process:

```bash
python -m _mock.providerlab.run
```

A single provider on its catalog port:

```bash
PROVIDERLAB_PROVIDER=helios-fx python -m _mock.providerlab.server
```

Every provider as its own container:

```bash
docker compose -f _mock/providerlab/docker-compose.yml up --build
```

Set `PROVIDERLAB_FAST=1` to disable injected latency and transient faults
(used by the test suite).

## Each provider's surface

- `GET /` — overview console for the provider.
- `GET /__lab/credentials` — credentials page (API keys, bearer tokens, mandates).
- `GET /__lab/clients` — OAuth client registrations.
- `GET /__lab/api-clients` — live callers observed on this port.
- `POST /__lab/api/*` — create/revoke credentials and clients.
- `/oauth/authorize`, `/oauth/token`, `/.well-known/oauth-authorization-server` — OAuth providers only.
- `POST /mcp` — JSON-RPC surface for MCP providers.
- `/api/{operation}` — the domain operations the provider exposes.
- `GET /healthz` — liveness.

Responses carry external-feel headers (`Server`, `X-Request-Id`,
`X-RateLimit-Limit`) and the lab applies per-caller rate limiting.

## Credentials

Each provider seeds one canonical credential on first start so verification flows
have known values. Credentials and their lifecycle state persist under
`_store/` (git-ignored). A consolidated `_store/_seed_index.json` lists every
provider's seed for quick lookup. Credentials support create, validate, and
revoke; OAuth providers additionally support client registration, authorization
codes, access tokens, and refresh.

## Provider SDK shims

The two `sdk`-category providers ship first-party clients under `_mock/sdk/`
(`zephyr_pay`, `terra_tax`). They are installed editable by `uv` via
`[tool.uv.sources]`; bare `pytest` adds them to `sys.path` through `conftest.py`.

## Tests

`tests/test_providerlab.py` covers taxonomy completeness, per-category accept and
reject paths, credential lifecycle, UI rendering, external-feel headers, the SDK
shim end to end, and the isolation guarantees (no mock logic outside `_mock`, no
Caracal SDK residue in `app/`).
