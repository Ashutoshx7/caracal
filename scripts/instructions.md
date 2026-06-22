# scripts

## Scope
- Covers repository-level automation under `scripts/`.

## Architecture Design
- Root scripts orchestrate release, publish, and CI workflows.
- Shared shell presentation and selection helpers live under `scripts/lib/`.
- Release records for the docs Releases page are generated from manifests by `scripts/generateReleaseRecord.mjs`.

## Required
- Must keep scripts executable, fail-fast, and runnable from the repository root.
- Must reuse `pnpm`, Go, Python, and package-manager commands already declared by the workspace.
- Must keep release and publish scripts deterministic and registry-explicit.

## Forbidden
- Must not embed secrets, tokens, or registry credentials.
- Must not duplicate complex package logic that belongs in package scripts.

## Validation
- Validate touched scripts with shell syntax checks and the narrow workflow command they wrap.

