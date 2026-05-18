# infra/secrets

## Scope
- Covers local development secret generation under `infra/secrets/`.

## Architecture Design
- `secretInit.mjs` creates file-backed Compose secrets under `files/` for local development only.
- Production deployments must provide secrets from an external manager.

## Required
- Must generate secret material with Node cryptographic randomness.
- Must keep `files/` gitignored and host-readable only by the local owner.
- Must keep generated filenames aligned with Compose secret declarations.
- Must support repeatable local initialization without printing secret values.
- Must keep all secret material in `files/` only; env files (`dev.env`, `local.env`, `caracal.env`) must never carry secret strings.

## Forbidden
- Must not commit generated files from `files/`.
- Must not bake secrets into images or manifests.
- Must not log, echo, snapshot, or test-assert raw secret values.
- Must not write secret values into any `.env` file; services consume them via the `*_FILE` convention only.

## Validation
- Validate with `pnpm secrets:init` after changing secret names or generation behavior.

