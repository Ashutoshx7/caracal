# Lynx Capital

A production-grade reference for running a SaaS platform on Caracal. Lynx Capital is a
wealth-management platform that serves many customer firms; each customer runs Portfolio,
Research, and Compliance agents over shared domain services, and every customer is isolated
from every other by its subject identity and the policy set.

The model is one zone with **one managed application per service** (`lynx-portfolio`,
`lynx-research`, `lynx-compliance`), **customers as subjects**, and least-privilege agent
sessions spawned per customer and role. The single source of truth is
[`config/tenancy.yaml`](config/tenancy.yaml); capability-to-scope mapping lives in
[`policies/manifest.json`](policies/manifest.json).

## 1. Install

```bash
cd caracal/examples/lynxCapital
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

## 2. Run

```bash
docker compose -f _mock/docker-compose.yml up -d --build --wait   # start mock providers
python -m uvicorn app.main:app --reload --port 8000               # run the app
```

Open `http://localhost:8000` and follow the guided `/setup` wizard. It walks you through the
Console setup — creating the zone, one managed application per service, the credential
providers and resources, importing the policy library, and modelling customers as subjects.
Tear the providers down with `docker compose -f _mock/docker-compose.yml down`.

## 3. Configure the workload

After the wizard, copy the values it shows into `.env`:

```bash
cp -n .env.example .env
```

`.env` holds only the Caracal variables the app reads at runtime: the zone, this service's
managed application credential, and `CARACAL_RESOURCES` (or a single `CARACAL_CONFIG` pointing
at the Console `caracal.toml` profile). Without Caracal configured, provider access fails
closed; set `LYNX_SIMULATION=1` only to exercise the offline simulators.

## 4. Provision automatically (optional, later)

The wizard's Console steps can be replayed from a script once you create a **scoped Control
key** in Console. This is optional and only convenient for repeatable environments:

```bash
cp -n .env.provision.example .env.provision   # fill in CONTROL_CLIENT_ID / _SECRET
. .env.provision
python scripts/provision.py                   # python scripts/teardown.py to undo
```

It reads `config/tenancy.yaml` + `policies/` and idempotently creates the managed
applications, registers the providers and resources, authors the policy library, and activates
the `lynx-platform` policy set. The Control key has no runtime data authority.

## 5. Run the SDK reference

```bash
python scripts/reference.py
```

[`scripts/reference.py`](scripts/reference.py) is the canonical SDK walkthrough: it prints the
full application/customer/agent/scope plan offline, and when Caracal is configured connects as
a service application, spawns each customer's role agents with narrowed grants, exercises
gateway resource authorization with `fetch()`, and demonstrates delegated least-privilege
fan-out.

Application code uses one seam, [`app/caracal.py`](app/caracal.py):

```python
from app import caracal

async with caracal.spawn_customer_agent("aurora", "portfolio", application_id="portfolio") as ctx:
    response = await caracal.fetch("portfolio", "/api/read", method="GET")
```

## 6. Test

```bash
opa test policies/ -v                        # 20 policy decision tests
python -m pytest -q                          # full example suite
```

Full policy documentation, expected access behavior, and testing instructions are in
[`policies/README.md`](policies/README.md).
