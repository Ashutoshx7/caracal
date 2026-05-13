# Post Release Validation Library

## Scope
- Only shared helpers sourced by sibling `validate*.sh` scripts.

## Required
- Helpers must operate on `$CARACAL_VERSION` and `$FINDINGS_DIR` env vars only.
- New helpers must be additive and must not shadow POSIX builtins.

## Forbidden
- Must not perform validation logic; helpers must be primitives only.
- Must not introduce stateful globals beyond severity and status constants.
