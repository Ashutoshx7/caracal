# connectors/redis

## Scope
- Covers Redis-backed connectors for Caracal revocation lookup and revocation stream consumption.

## Required
- Must implement storage-backed adapters outside the storage-neutral `revocation` packages.
- Must verify signed stream messages when a stream HMAC key is configured.
- Must fail closed on Redis lookup errors by default.

## Forbidden
- Must not perform JWT verification or transport authentication.
- Must not import framework-specific packages.
