# Post Release Validation

## Scope
- Only scripts that exercise already-published Caracal artifacts and emit JSONL findings.

## Required
- Every script must include the standard file header and start with `#!/usr/bin/env bash`.
- Every script must `set -euo pipefail` and source `lib/common.sh`.
- Every script must emit findings via `logFinding` and must not write reports directly.
- Every script must honor `DRY_RUN=1` and the `ONLY` filter via `matchesOnly`.
- Every script must exit 0 on logged failures; the orchestrator decides overall status.
- Every script must use only `curl`, `docker`, `gh`, `cosign`, `python3`, `node`, `bun`, `pnpm`, `npm`, `yarn`, `pip`, `uv`, `poetry`, and standard POSIX tools.

## Forbidden
- Must not call into `caracalEnterprise/` paths.
- Must not consume secrets at runtime beyond `GH_TOKEN` and registry tokens already exposed by the workflow.
- Must not rebuild local artifacts; this layer only validates published artifacts.
- Must not mutate the working tree outside `$FINDINGS_DIR` and `mktemp -d` scratch directories.
