# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs

# caracal/scripts

## Scope
- Covers only the operator scripts in `caracal/infra/scripts/`.

## Required
- Must probe all app service `/ready` paths in `smokeTest.sh` for CI gates and post-deploy validation.
- Must exit non-zero on the first failed probe.
- Must default `CARACAL_SMOKE_HOST` to `127.0.0.1` and allow override via environment variable.

## Forbidden
- Must not import or reference `caracalEnterprise/`.
- Must not store secrets or credentials in any script.
- Must not bypass or ignore service health gates.
