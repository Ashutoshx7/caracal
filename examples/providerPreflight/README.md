# Provider Preflight

Validates that a provider-backed resource is ready for its first Gateway call.
The Console and API already validate provider config structure at creation time;
this preflight covers the live, end-to-end concerns they cannot check at write
time, so an evaluation does not stall on a silent misconfiguration.

## Checks

| Check | What it confirms |
| --- | --- |
| Resource binding | The resource resolves to exactly one credential provider and a Gateway application. |
| Token endpoint host | For OAuth providers, the token endpoint is HTTPS and resolves to a public, routable address. |
| Callback reachability | For authorization-code providers, the HTTPS callback origin is reachable so providers can return the browser. |
| Upstream reachability | The resource upstream URL is reachable (from this host — see the position note). |
| Runtime injection | When requested, the provider sets `allow_runtime_injection=true`. |
| Policy authorization | The active policy set returns `allow` for the application, resource, and scopes. |

The preflight fails closed: any failed check exits non-zero.

## Run

```bash
cd examples/providerPreflight
CARACAL_API_URL=http://127.0.0.1:3000 \
CARACAL_ADMIN_TOKEN=<admin-token> \
PREFLIGHT_ZONE_ID=<zone-id> \
PREFLIGHT_RESOURCE_ID=<resource-id> \
PREFLIGHT_APPLICATION_ID=<app-id> \
PREFLIGHT_SCOPES=pipernet:read,pipernet:write \
node run.mjs
```

Optional:

- `PREFLIGHT_PRINCIPAL_ID` — defaults to the application id.
- `PREFLIGHT_REQUIRE_RUNTIME_INJECTION=true` — enforce runtime-injection eligibility.

## Position note

`Upstream reachability` and `Callback reachability` probe from the host that runs
this script. The Gateway enforces its own upstream allowlist and private-address
rejection; run the preflight from a network position comparable to the Gateway
(or inside the cluster) to make the reachability result meaningful.

## Test

```bash
node --test
```

Tests are fully offline: network, DNS, and policy responses are injected.
