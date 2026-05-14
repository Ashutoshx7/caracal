# Contributing to Caracal

## Prerequisites

| Tool                | Version | Required for                |
| ------------------- | ------- | --------------------------- |
| Node.js             | 24+     | All work                    |
| pnpm                | 10+     | All work                    |
| Docker + Compose v2 | 24+     | Running the stack           |
| Git                 | 2.x     | All work                    |
| Go                  | 1.26+   | Go services / packages      |
| Python              | 3.11+   | Python packages             |
| Bun                 | latest  | Building CLI / TUI binaries |

## Setup

```bash
git clone https://github.com/Garudex-Labs/caracal.git && cd caracal
pnpm install
cp infra/docker/.env.example infra/docker/.env   # set POSTGRES_PASSWORD, REDIS_PASSWORD, CARACAL_ADMIN_TOKEN
pnpm caracal up                                  # build + start the full stack
pnpm caracal init                                # provision local zone, write caracal.toml
```

Drop the `pnpm` prefix with `pnpm link --global` (undo with `pnpm unlink --global caracal`).

## Modes: dev vs runtime

Every artifact is bound to one of two modes at build time. The mode is stamped into `apps/cli/src/runtime/version.gen.ts` (gitignored) and propagated to services via `CARACAL_MODE`.

|                       | Dev                                                      | Runtime                                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Stamped by            | `apps/cli/scripts/stampDev.mjs` (auto on `pnpm caracal`) | `apps/cli/scripts/stampRelease.mjs` (release CI)            |
| `caracal --version`   | `2026.05.12+dev.<sha> [dev (sha …)]`                     | `2026.05.12 [runtime]`                                      |
| Container images      | `localhost/caracal-{svc}:dev-<sha>` (built locally)      | `ghcr.io/garudex-labs/caracal-{svc}:v<calver>` (pulled)     |
| Compose file          | `infra/docker/docker-compose.yml`                        | embedded in CLI, installed to `~/.caracal/compose.yml`      |
| `INSECURE_*` env vars | honored                                                  | refused; services panic on startup                          |

The base CalVer is centralized in `apps/cli/runtime/release.json`. Bump it there if local builds need a new base version — never edit `version.gen.ts` by hand.

### Test a release-style binary locally

```bash
pnpm --dir apps/cli build:release                    # stamp runtime + bun compile (5 targets)
"$PWD/apps/cli/dist/caracal-linux-x64" --version     # → caracal <ver> [runtime]
(cd /tmp && "$OLDPWD/apps/cli/dist/caracal-linux-x64" up)
```

Override the version a release binary targets (also useful for pinning during dev): `CARACAL_VERSION=v2026.04.01 caracal up`.

## Stack Commands

```bash
pnpm caracal up [--build]           # start stack (--build forces rebuild)
pnpm caracal down [-v]              # stop (-v wipes volumes)
pnpm caracal status                 # /health probe every service
pnpm caracal init [--force]         # provision zone (--force rotates the secret)
pnpm caracal purge [targets...]     # cleanup: stack/volumes/logs/config/runtime/cache
pnpm caracal run -- <cmd>           # run <cmd> with RESOURCE_TOKEN injected
pnpm caracal credential read <res>  # resolve a credential
pnpm caracal --help
```

## Development

### CLI

```bash
pnpm --dir apps/cli dev
pnpm --dir apps/cli typecheck
```

### TUI

Stack must be up and provisioned first.

```bash
export CARACAL_ADMIN_TOKEN=$(grep ^CARACAL_ADMIN_TOKEN infra/docker/.env | cut -d= -f2)
pnpm --filter @caracalai/tui dev
```

TUI env vars match the CLI: `CARACAL_ADMIN_TOKEN`, `CARACAL_API_URL`, `CARACAL_COORDINATOR_URL`, `CARACAL_COORDINATOR_TOKEN`, `CARACAL_ZONE_ID`. Config discovery: `$CARACAL_CONFIG` → `caracal.toml` (cwd / `$PWD` / `$INIT_CWD`) → `$XDG_CONFIG_HOME/caracal/caracal.toml`. Keybindings live in the README.

## Tests

```bash
pnpm test                                    # full suite (ts + go + py)
pnpm run test:typescript | test:go | test:python
pnpm --dir apps/<name> test                  # single TS package
go test ./services/<name>/...                # single Go service
```

`scripts/testCi.sh` mirrors `.github/workflows/test.yml` locally:

```bash
scripts/testCi.sh                # full suite (ts + go + py + docs)
scripts/testCi.sh --smoke        # post-merge smoke (pnpm -r build + go vet)
scripts/testCi.sh --ts | --go | --py
```

## Code Style

- Header and naming rules are enforced by `.claude/rules/` and `.github/instructions/`.
- One implementation per feature — no fallback paths, shims, or dead branches.
- Match surrounding abstraction level. Don't introduce helpers a single caller could inline.

## Submitting Changes

1. Branch off `main`. Keep commits focused.
2. Add a changeset for any change to a published package: `pnpm changeset`.
3. If you touched API / STS / CLI, smoke-test end-to-end: `pnpm caracal up && pnpm caracal init && pnpm caracal run -- printenv RESOURCE_TOKEN`.
4. `pnpm test` must pass.
5. `git commit -s` (DCO sign-off), open the PR, describe the change and any new `instructions.md` entries.

## Building Binaries

`bun build --compile` produces self-contained executables (no Node / Bun on the target).

```bash
pnpm --dir apps/{cli,tui} sync-embedded               # required before any compile
pnpm --dir apps/{cli,tui} build[:<os>-<arch>]         # all 5 targets, or a single one (e.g. build:linux-arm64)
```

Output lands in `apps/{cli,tui}/dist/caracal[-tui]-<os>-<bunArch>[.exe]` (`<bunArch>` ∈ {`x64`, `arm64`}). The release workflow renames these into versioned archives; locally you work with the raw dist files.

## Releases

Release artifacts share one CalVer: `vYYYY.MM.DD` (suffix `.N` for same-day re-cuts). Only maintainers listed in `.github/MAINTAINERS` may cut releases.

### Cutting a release

```bash
scripts/release.sh               # applies changesets, computes CalVer, tags, pushes
scripts/release.sh --dry-run     # preview without tagging
```

Pushing the tag triggers `.github/workflows/release.yml`, which produces:

- 10 archives (5 CLI + 5 TUI), `SHA256SUMS`, SLSA provenance
- 5 multi-arch GHCR images with provenance + SBOM, tagged `v<calver>` and `vYYYY.MM`
- A GitHub Release with archives, `SHA256SUMS`, `install.sh`, `install.ps1`

### Post-release validation

`postReleaseValidation.yml` runs automatically after `release.yml` succeeds (or trigger with `gh workflow run postReleaseValidation.yml -f release=v2026.05.12`). It exercises registries, archives, installers, containers, and provenance, then opens a PR with `releases/<tag>/validation.md`.

Reproduce one area locally:

```bash
CARACAL_RELEASE=v2026.05.12 FINDINGS_DIR=/tmp/findings \
  bash scripts/postRelease/validateRegistryMetadata.sh
```

### Publishing to npm and PyPI

```bash
./scripts/publishNpm.sh
./scripts/publishPypi.sh             # PyPI
./scripts/publishPypi.sh --testpypi   # TestPyPI
```

Interactive picker (↑/↓ to move, space to toggle, `a` all, enter confirms), prompts for the registry token, builds and uploads each selected package, skips versions already published. Both scripts refuse to publish dev-stamped versions (`+dev.<sha>` / `-dev.<sha>`).

### Published artifacts

```
npm:    @caracalai/{core,oauth,admin,identity,revocation,sdk,
                    transport-mcp,transport-a2a,
                    mcp-express,mcp-fastmcp,tokenstate-postgres,revocation-redis}
pypi:   caracalai-{core,identity,revocation,sdk,transport-mcp,mcp-fastmcp,revocation-redis}
ghcr:   ghcr.io/garudex-labs/caracal-{api,sts,gateway,audit,coordinator}
```

Browse: [npm](https://www.npmjs.com/~caracal-run) · [PyPI](https://pypi.org/user/CaracalAI).

### Rollback

Never delete a published tag. Roll forward with a new CalVer tag. The floating `vYYYY.MM` image tag moves with the new cut; pinned `v<calver>` tags are immutable.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

Apache-2.0. By contributing you agree your contribution is licensed under the same terms ([LICENSE](LICENSE)).
