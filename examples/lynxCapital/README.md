# Lynx Capital

A production-grade reference for running a multi-tenant SaaS platform on Caracal. Lynx
Capital is a wealth-management platform that serves many customer firms (tenants). Each
tenant runs Portfolio, Research, and Compliance agents over shared domain services, and
every tenant is isolated from every other by identity, grants, and policy.

This example is the primary reference implementation for modelling tenants, applications,
agents, resources, policies, and the SDK flows that tie them together.

## Architecture

```
Lynx Capital platform (one zone)
│
├── lynx-platform              managed application — the durable platform runtime credential
│     └── agent sessions       spawned per tenant + role, labelled tenant:<id> + capabilities
│
├── resources
│     ├── resource://portfolio   portfolio:read | portfolio:write | portfolio:admin
│     ├── resource://research     research:read  | research:write
│     └── resource://compliance   compliance:review | compliance:admin
│
├── policy set "lynx-multitenant"   00-base + 11 scenario policies (policies/)
│
└── tenants
      ├── aurora    DCR application tenant-aurora    → portfolio / research / compliance agents
      └── borealis  DCR application tenant-borealis  → portfolio / research / compliance agents
```

The single source of truth for this model is [`config/tenancy.yaml`](config/tenancy.yaml);
the capability-to-scope mapping lives in [`policies/manifest.json`](policies/manifest.json).

### Managed application vs DCR applications

| | Managed application (`lynx-platform`) | DCR application (`tenant-<id>`) |
| --- | --- | --- |
| Purpose | Durable platform runtime credential | Per-tenant isolated credential boundary |
| Lifetime | Long-lived | Auto-expiring (`expires-in`, ≤ 3600s) |
| Count | One for the whole platform | One per customer tenant |
| Spawns agents | Yes — fan-out of labelled agent sessions | No — leaf/single-session |
| Use it when | The platform itself acts and orchestrates | A tenant needs an independent, revocable identity |

Per-tenant **agents** are not separate applications. They are agent sessions spawned under
`lynx-platform`, carrying a `tenant:<id>` binding label plus the role's capability labels.
This keeps one durable credential while giving every tenant/role its own least-privilege,
independently revocable session and audit trail.

### Tenant isolation

Three independent layers must all agree before any call succeeds:

1. **Grants** bind each tenant's subject (`customer:<id>`) only to its own resource scopes.
   A cross-tenant request has no grant and is rejected before policy runs.
2. **Labels** stamp every agent session with `tenant:<id>`; the policy library requires the
   label tenant to match the request's tenant claim.
3. **Policy** (`policies/00-base.rego`) is default-deny and only allows scopes that a loaded
   capability explicitly contributes for the matching tenant.

## Quick start (full platform)

### 1. Install

```bash
cd caracal/examples/lynxCapital
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

### 2. Configure the environment

```bash
cp -n .env.example .env
```

`.env` is grouped into: deployment environment + service endpoints, the managed platform
application, the control automation key, the admin token, the three domain resource
upstreams, and the model key. Fill in the values you have; provisioning produces the rest.
See [Environment model](#environment-model).

### 3. Provision the platform

Provisioning is idempotent and reads `config/tenancy.yaml` + `policies/`:

```bash
python scripts/provision.py
```

It creates the managed application, the three resources, authors the policy library and
activates the `lynx-multitenant` policy set, registers a DCR application per tenant, and
binds each tenant's grants. One-time secrets are written to `config/provisioned.json`
(keep it untracked). Tear down with `python scripts/teardown.py`.

### 4. Run the SDK reference

```bash
python scripts/reference.py
```

[`scripts/reference.py`](scripts/reference.py) is the canonical SDK walkthrough: it prints
the full tenant/agent/scope plan offline, and when Caracal is configured it authenticates
as the managed platform, spawns each tenant's role agents with narrowed grants, exercises
gateway resource authorization, and demonstrates delegated least-privilege fan-out — with
redacted secrets and fail-closed error handling.

## When to use what

- **Onboard a tenant**: add a tenant block to `config/tenancy.yaml` (id, name, DCR app name,
  subject, agents) and re-run `scripts/provision.py`. The new tenant gets its own DCR
  application, grants, and agents; existing tenants are untouched.
- **Add a capability/policy**: drop a `*.rego` into `policies/`, register it in
  `policies/manifest.json` (capability → resource → grants) and map it to a role. Re-run
  provisioning to author and activate the new policy-set version.
- **Add a resource**: add it under `resources:` in `config/tenancy.yaml` with its scopes and
  an `upstreamEnv`, then point that env var at the upstream per environment.

## Policy library

[`policies/`](policies/) is an importable, OPA-tested library. `00-base.rego` provides the
default-deny decision contract and tenant isolation; eleven scenario policies
(`portfolio-read/write/admin`, `research-read/write`, `compliance-review/admin`,
`customer-admin`, `auditor`, `delegated-advisor`, `emergency-access`) each contribute the
scopes their capability allows. Full documentation, expected access behavior, and testing
instructions are in [`policies/README.md`](policies/README.md).

```bash
opa test policies/ -v
```

## SDK integration

Application code uses one seam, [`app/caracal.py`](app/caracal.py):

```python
from app import caracal

# Spawn a tenant's role agent under the managed platform application: tenant + capability
# labels, a delegation edge narrowed to the role's least-privilege scopes.
async with caracal.spawn_agent("aurora", "portfolio") as ctx:
    response = caracal.gateway_call("portfolio", "read", {"account": "..."})

# Authenticate as a tenant's isolated DCR application.
client = caracal.tenant_client(application_id, client_secret)
```

`spawn_agent` derives labels and scopes from `config/tenancy.yaml` + `policies/manifest.json`
via [`app/tenancy.py`](app/tenancy.py), so the SDK, provisioning, and policy all stay
consistent with a single model.

## Environment model

| Variable | Purpose |
| --- | --- |
| `CARACAL_ENVIRONMENT` | `local` / `staging` / `production` selector. |
| `CARACAL_ZONE_ID` | The platform's isolation boundary. |
| `CARACAL_STS_URL` / `CARACAL_COORDINATOR_URL` / `CARACAL_GATEWAY_URL` | Runtime service endpoints. |
| `CARACAL_CONTROL_URL` / `CARACAL_API_URL` | Provisioning (control catalog) and admin (grants) endpoints. |
| `CARACAL_APPLICATION_ID` / `CARACAL_APP_CLIENT_SECRET` | The managed platform application credential. |
| `CONTROL_CLIENT_ID` / `CONTROL_CLIENT_SECRET` / `CONTROL_AUDIENCE` | Control automation key used by `scripts/provision.py`. |
| `CARACAL_ADMIN_TOKEN` | Authorizes resource-grant creation through the Admin API. |
| `LYNX_RESOURCE_PORTFOLIO_URL` / `_RESEARCH_URL` / `_COMPLIANCE_URL` | Domain resource upstreams per environment. |
| `OPENAI_API_KEY` | Model provider key. |

Per-tenant DCR secrets are produced by provisioning into `config/provisioned.json`; they are
never placed in `.env`.

## Testing

```bash
opa test policies/ -v                       # 20 policy decision tests
python -m pytest tests/test_policy_library.py tests/test_tenancy_plan.py -q
python -m pytest -q                          # full example suite
```

The identity-layer tests cover the policy decision suite, the provisioning-plan builders
(managed/DCR/resource/policy commands, per-tenant grants), and the multi-tenant setup
surface. They run offline — no live control plane required.

## Production-readiness review

- **Security / authorization boundaries** — default-deny base policy; every requested scope
  must be explicitly contributed by a loaded capability. No allow-all baseline.
- **Tenant isolation** — enforced redundantly by grants, session labels, and policy; a
  cross-tenant request fails at the grant layer before policy and again in policy.
- **Privilege escalation** — agents are spawned with grants narrowed to the role's scopes;
  `emergency-access` requires a resolved step-up challenge; `delegated-advisor` intersects
  with the delegation edge's scopes.
- **Secret management** — one-time secrets land only in `config/provisioned.json`; the SDK
  reference redacts tokens; the gateway holds upstream provider credentials so application
  code never sees them.
- **DCR boundaries** — per-tenant applications auto-expire (`expires-in ≤ 3600s`) and are
  independently revocable, limiting blast radius.
- **SDK ergonomics** — a single `app/caracal.py` seam; model-driven labels/scopes keep the
  SDK, provisioning, and policy in lock-step.
- **Maintainability** — onboarding a tenant or capability is a config/manifest edit plus a
  re-run of provisioning; no code changes.

---

## Bundled demo workload (optional)

The repository also ships a FastAPI + LangGraph swarm that processes a simulated global
payout cycle against a local mock provider network under `_mock/`. It is an optional
workload for exercising the runtime and is independent of the multi-tenant identity model
above.

```bash
docker compose -f _mock/docker-compose.yml up -d --build --wait   # start mock providers
python -m uvicorn app.main:app --reload --port 8000               # run the app
docker compose -f _mock/docker-compose.yml down                   # tear down
```

Open `http://localhost:8000`; the landing page leads through the overview pages before the
guided `/setup` wizard, which teaches the managed-application, policy-library, and per-tenant
DCR flow described here.
