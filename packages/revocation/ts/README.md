# Caracal Revocation for TypeScript

TypeScript revocation lookup interface and in-memory default for Caracal resource servers.

The in-memory store is process-local. Distributed production deployments should use a connector-backed store and fail closed when revocation cannot be checked or writes cannot be confirmed.

