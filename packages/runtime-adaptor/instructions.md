# runtime-adaptor

## Scope
- Covers runtime adaptors that bind Caracal to a specific platform runtime, grouped by runtime.

## Required
- Each child directory must wrap exactly one runtime platform (e.g. Cloudflare Workers).

## Forbidden
- Must not implement token caching or other state backends.
- Must not implement transport, framework, or identity logic.
