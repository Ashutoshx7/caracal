# Lynx Capital

Autonomous financial execution layer demo. A FastAPI + LangGraph swarm that
processes a global SaaS payout cycle (~4,200 invoices, 5 regions) end-to-end
with a live agent topology view and SSE log stream.

## Requirements

- Python 3.14+
- Docker
- An OpenAI API key

## Quick start

### 1 — Install dependencies

```bash
cd /path/to/lynxCapital
python -m venv .venv && source .venv/bin/activate
set -a
. ./caracal.prerelease.env
set +a

pip install -e .
pip install \
  -e _mock/sdk/lynx_sdk_stripe_treasury \
  -e _mock/sdk/lynx_sdk_tax
```

This project is selected to the Caracal rc package in `pyproject.toml`; the
package still resolves from the prerelease Python index, not from a local source
path.

### 2 — Configure environment

```bash
cp .env.example .env
set -a
. ./caracal.prerelease.env
set +a
```

Open `.env` and set `OPENAI_API_KEY=sk-...`. Provider credentials are normal
integration settings; Caracal credentials come from `caracal.toml`. The
`caracal.prerelease.env` file selects the rc npm/PyPI/container/binary
endpoints for production-like local testing.

### 3 — Start Caracal through TUI + control API

Caracal (API + Coordinator + Gateway + STS + Redis) must be running before
Lynx starts. Install the rc CLI/TUI binaries from the prerelease binary channel
and bring up the stack the same way an end user would:

```bash
set -a
. ./caracal.prerelease.env
set +a

channel="${CARACAL_PRERELEASE_BINARY_CHANNEL%/}"
base="$channel/${CARACAL_VERSION}"
curl -fsSL "$channel/install-cli.sh" \
  | sh -s -- --version "$CARACAL_VERSION" --base-url "$base"
curl -fsSL "$channel/install-tui.sh" \
  | sh -s -- --version "$CARACAL_VERSION" --base-url "$base"

# Bring up the OSS stack
caracal up

# Open the TUI. Use it to inspect/create:
#   1. zone: Lynx Capital
#   2. control key: lynx-control (copy client_secret once)
#   3. resources: lynx/<provider> for every provider in config/company.yaml
CARACAL_CONTROL_ENABLED=true caracal-tui
```

The TUI talks to the same control plane as the CLI. The control key is a real
Caracal application credential with the `control:invoke` trait; Lynx stores
its `client_id` as `application_id` and its one-time `client_secret` as
`app_client_secret` in `caracal.toml`.

### 4 — Write `caracal.toml` from TUI values

After creating the Lynx zone, control key, and resources in the TUI, write
`~/.config/caracal/caracal.toml`. The Python SDK reads this file directly, so
Caracal credentials stay out of `.env`.

```toml
zone_url = "http://127.0.0.1:8080"
sts_url = "http://127.0.0.1:8080"
coordinator_url = "http://127.0.0.1:4000"
gateway_url = "http://127.0.0.1:8081"
zone_id = "<zone id from TUI>"
application_id = "<control key client_id>"
app_client_secret = "<control key client_secret>"

[[credentials]]
env = "LYNX_MERCURY_BANK_TOKEN"
resource = "lynx/mercury-bank"
upstream_prefix = "http://127.0.0.1:8800"
```

Repeat `[[credentials]]` for every `lynx/<provider>` resource in
`config/company.yaml`. REST provider bindings use
`upstream_prefix = "http://127.0.0.1:8800"` for local Python runs; direct
protocol providers use their own local endpoints, such as
`http://127.0.0.1:50051` for `lynx/treasury-ops` and
`http://127.0.0.1:7800` for `lynx/vendor-portal`.

The stack listens on:

- API         → `http://localhost:3000`
- Coordinator → `http://localhost:4000`
- Gateway     → `http://localhost:8081`
- STS         → `http://localhost:8080`

The defaults in `.env.example` already point at these. If you run Caracal on
different hosts/ports, edit the `CARACAL_*` block in `.env` and the URLs in
`caracal.toml`.

> If you already had the Caracal monorepo cloned and used `pnpm i -g` from it,
> remove the stale workspace shim first so the released binary wins:
> `rm "$(pnpm bin -g)/caracal" 2>/dev/null || true`.

### 5 — Start the local provider network

The local provider network lives under `_mock/` and supplies the demo's
third-party provider fixtures across REST, SSE, gRPC, and MCP. The Lynx app
still calls providers through its registry and transport clients, and the image
joins `caracalData` so the Caracal gateway can forward to REST providers by
resource.

```bash
docker compose -f _mock/docker-compose.yml up -d --build --wait
```

To re-check status later:

```bash
docker compose -f _mock/docker-compose.yml ps -a
```

### 6 — Run Lynx Capital

Pick one path:

```bash
# Local Python (development)
python -m uvicorn app.main:app --reload --port 8000

# Container (production-like — joins the provider and caracalData networks)
docker compose up -d --build
```

Open **http://localhost:8000**.

## Demo flow

1. Open `CARACAL_CONTROL_ENABLED=true caracal-tui` and verify the Lynx zone,
   control key, resources, live agent sessions, tickets, and delegation tree.
2. Open `http://localhost:8000/setup`, follow the TUI and `caracal.toml`
   checklist, then validate.
3. Open `/demo` and submit a prompt. The browser uses the Lynx control API:
   `POST /api/run/start`, `GET /api/run/{runId}/events`,
   `GET /api/run/{runId}/status`, `POST /api/run/{runId}/cancel`, and
   `GET /api/run/{runId}/lineage`.
4. Keep the TUI open while the run executes to inspect Caracal sessions and
   delegated child agents in the real control plane.

## Routes

| Path | Description |
|---|---|
| `/` | Landing — scenario summary |
| `/setup` | Validates `OPENAI_API_KEY` and Caracal connectivity |
| `/demo` | Chat interface + live agent topology graph |
| `/logs` | Color-coded runtime activity stream |
| `/prompts` | Example prompts grouped by execution pattern |

## Example prompts

The `/prompts` page lists ready-to-run prompts. A few to start with:

- *"Run the full global payout cycle for this month."*
- *"Process all US region vendor invoices and submit to QuickBooks."*
- *"Run treasury close for Q2 and file compliance reports for DE and SG."*
- *"Audit all open receivables and flag overdue accounts."*

## Tests

```bash
pytest tests/
```

## Tear down

```bash
docker compose -f _mock/docker-compose.yml down
caracal down
# or, for a full reset (containers + volumes + caracal.toml):
caracal purge --include-destructive all
```

## Layout

```
app/             FastAPI app (api, web, agents, orchestration, services, events, core)
config/          company.yaml (copy, regions, providers, swarm caps, theme)
_mock/           Local provider fixtures (not published)
tests/           Topology, lifecycle, and provider transport tests
INSTRUCTIONS.md  Build rules
```
