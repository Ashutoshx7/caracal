# Contributing to Caracal

<details>
<summary>Prerequisites</summary>

| Tool                | Version |
| ------------------- | ------- |
| Node.js             | 24+     |
| pnpm                | 11.1.1  |
| Docker + Compose v2 | 24+     |
| Go                  | 1.26+   |
| Python              | 3.14+   |
| Bun                 | latest  |

- `<os>` ∈ `linux` · `darwin` · `windows`
- `<arch>` ∈ `x64` · `arm64`

</details>

<details>
<summary>Modes</summary>

|                       | Dev                                                      | Runtime                                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `caracal --version`   | `2026.05.14+dev.<sha> [dev (sha …)]`                     | `v2026.05.14 [runtime]` (Released) / `dev-<sha> [runtime]` (local)|
| Container images      | `localhost/caracal-{svc}:dev-<sha>` (built locally)      | `ghcr.io/garudex-labs/caracal-{svc}:v<calver>` (Released) / `localhost/caracal-{svc}:dev-<sha>` (local) |

</details>

## Setup

```bash
git clone https://github.com/Garudex-Labs/caracal.git && cd caracal
pnpm install
pnpm caracal up                     # Build and start the full stack

# Essential Commands
pnpm caracal --help                 # Show CLI help and available commands
pnpm caracal status                 # Check health status of all services
pnpm caracal down [--help]          # Stop the stack
pnpm caracal purge                  # Remove stack, volumes, logs, cache, and runtime data
```

<details>
<summary>Drop the `pnpm` prefix</summary>

```bash
pnpm link --global            # Install global symlink
pnpm unlink --global caracal  # Remove global symlink
```

</details>

#### CLI

```bash
pnpm caracal cli
pnpm --dir apps/cli typecheck
```

#### TUI

```bash
pnpm caracal tui
```

CLI and TUI are exact alternatives over the same engine.

#### Control API (optional)

The control service is an OAuth-protected HTTP API hosted by the engine for any external client (script, AI agent, workflow, or another instance of CLI/TUI) that needs to drive Caracal programmatically. It is off by default.

```bash
docker compose --profile control up control   # start the surface (CARACAL_CONTROL_ENABLED=true)
```

Clients authenticate with a standard OAuth2 client-credentials flow against STS.

```bash
# mint a token (any OAuth2 client; CLI/TUI use their caracal.toml app creds)
curl -sX POST "$ZONE_URL/oauth/2/token" \
  -u "$APP_CLIENT_ID:$APP_CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=control:invoke" | jq -r .access_token

# invoke
curl -sH "Authorization: Bearer $TOKEN" \
  -d '{"command":"zone","subcommand":"list"}' \
  http://localhost:8087/v1/control/invoke
```

## Tests

```bash
pnpm test                                    # full suite (ts + go + py)
pnpm run test:typescript | test:go | test:python
```

`scripts/testCi.sh` mirrors `.github/workflows/test.yml` locally:

```bash
scripts/testCi.sh                # full suite (ts + go + py + docs)
scripts/testCi.sh --smoke | --go | --py | --ts
```

## Submitting Changes

1. Create a branch from `main` and keep changes focused.
2. Keep the scope minimal (few files/components, small commits).
3. Run a quick local sanity check:
  - `pnpm caracal up`
  - `pnpm caracal status`
  - `pnpm caracal cli`
  - `pnpm caracal tui`
4. Ensure tests pass:
  - `pnpm test`
  - `scripts/testCi.sh --smoke` (post-commit parity)
  - `scripts/testCi.sh` (daily-check parity)
5. Commit with a clear message and open a PR.

## Releases

Release artifacts share one CalVer: `vYYYY.MM.DD` (suffix `.N` for same-day re-cuts). Only maintainers listed in `.github/MAINTAINERS` may cut releases.

### Test a release-style binary locally

Run from the repo root:

```bash
pnpm --dir apps/cli build:release                          # stamp runtime + build local images + bun compile (all targets)
pnpm --dir apps/tui build:release                          # stamp runtime + bun compile (all targets)
BIN="$(pwd)/apps/cli/dist/caracal-cli-<os>-<arch>"         # absolute path; survives cd
TUI="$(pwd)/apps/tui/dist/caracal-tui-<os>-<arch>"         # TUI binary; same OS/arch matrix
pnpm caracal down                                          # Stop dev to test runtime
"$BIN" --version                                           # → caracal dev-<sha> [runtime]
"$TUI" --version                                           # → caracal-tui dev-<sha> [runtime]
(cd /tmp && "$BIN" up && "$BIN" status && "$TUI" && "$BIN" down)
```

The local `build:release` stamps the binary with `CARACAL_VERSION=dev-<sha>` and `CARACAL_REGISTRY=localhost/`, then runs `docker compose build` to produce `localhost/caracal-{svc}:dev-<sha>` for each service. The release-style binary resolves to those images — no GHCR pull, no auth, fully reproducible from your checkout. The TUI variant stamps `CARACAL_TUI_VERSION` / `CARACAL_TUI_MODE=runtime` and shares the same engine-installed runtime assets.

### Cutting a release

```bash
scripts/release.sh               # applies changesets, computes CalVer, tags, pushes
scripts/release.sh --dry-run     # preview without tagging
```

Pushing the tag triggers `.github/workflows/release.yml`

### Post-release validation

`postReleaseValidation.yml` runs automatically after `release.yml` succeeds. It exercises registries, archives, installers, containers, and provenance, then opens a PR with `releases/<tag>/validation.md`.

Reproduce one area locally:

```bash
CARACAL_RELEASE=v2026.05.14 FINDINGS_DIR=/tmp/findings \
  bash scripts/postRelease/validateRegistryMetadata.sh
```

### Publishing to npm and PyPI

```bash
./scripts/publishNpm.sh
./scripts/publishPypi.sh             # PyPI
./scripts/publishPypi.sh --testpypi   # TestPyPI
```

Skips versions already published. Both scripts refuse to publish dev-stamped versions (`+dev.<sha>` / `-dev.<sha>`).

### Published artifacts

```
npm:    @caracalai/{core,oauth,admin,identity,revocation,sdk,
                    transport-mcp,transport-a2a,
                    mcp-express,mcp-fastmcp,tokenstate-postgres,revocation-redis}
pypi:   caracalai-{core,identity,revocation,sdk,transport-mcp,mcp-fastmcp,revocation-redis}
ghcr:   ghcr.io/garudex-labs/caracal-{api,sts,gateway,audit,coordinator,redis}
```

Browse: [npm](https://www.npmjs.com/~caracal-run) · [PyPI](https://pypi.org/user/CaracalAI).

### Rollback

Never delete a published tag. Roll forward with a new CalVer tag. The floating `vYYYY.MM` image tag moves with the new cut; pinned `v<calver>` tags are immutable.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

Apache-2.0. By contributing you agree your contribution is licensed under the same terms ([LICENSE](LICENSE)).
