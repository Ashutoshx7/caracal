# revocation/go

## Scope
- Covers only the `github.com/garudex-labs/caracal/packages/revocation/go` Go module under `packages/revocation/go/`.

## Required
- Must define the revocation lookup interface and ship an in-memory default implementation.

## Forbidden
- Must not contain any storage backend code.
- Must not depend on identity, transport, or framework packages.
