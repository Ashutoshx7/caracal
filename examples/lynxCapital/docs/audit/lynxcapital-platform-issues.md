# Caracal Platform Issues Surfaced By LynxCapital Audit

Discovered while bringing `examples/lynxCapital` to a production-grade
Caracal integration on release `v2026.05.14`. Each finding lives in the
Caracal platform itself and must be fixed there, not papered over inside
LynxCapital.

## CP-1: `Caracal.headers()` silently falls back to bootstrap subject

**Location:** `caracal/packages/sdk/python/caracalai_sdk/client.py:481-487`

**Root cause:** When no `CaracalContext` is bound to the current task,
`headers()` returns the bootstrap application subject token. Background
worker patterns (asyncio task groups, thread pools, FastAPI background
tasks) routinely run outside the contextvar set by `spawn(...)`. Every
such call leaks the root identity to the gateway.

**Blast radius:** Cross-product. Any application that fans work out of
the request task: exactly the swarm pattern LynxCapital uses for
regional orchestrators and payment-execution agents: collapses every
identity to root, defeating delegation and gateway scope checks.

**Recommended fix:** Make `headers()` raise `RuntimeError("no Caracal
context bound: pass allow_root=True to use the bootstrap subject")`
unless `allow_root=True` is passed explicitly. Provide an SDK-level
`bind(parent_ctx)` helper documented as the boundary contract for
background tasks.

## CP-2: `from_config` ignores `CARACAL_RESOURCES_FILE`

**Location:** `caracal/packages/sdk/python/caracalai_sdk/client.py:307`
(`from_config`) vs `client.py:206-209` (`from_env`).

**Root cause:** `from_env` calls `_load_resource_bindings_file(e.get(
"CARACAL_RESOURCES_FILE"))`; `from_config` does not. Two code paths for
the same intent. Operators who set the env var alongside a
`caracal.toml` discover at runtime that one path is silently dropped.

**Blast radius:** Resource bindings determine gateway prefix routing.
Silent drop produces 404s with no log line tying the failure back to
config provenance.

**Recommended fix:** Extract resource resolution into one helper used
by both factories (`_resolve_bindings(cfg_credentials, env)`) that
unions credentials-block + env-file + env-flat sources and validates
the merged set.

## CP-3: No public API to spawn against an explicit parent context

**Location:** `caracal/packages/sdk/python/caracalai_sdk/client.py:378`
(`spawn`) and `client.py:429` (`delegate_to_spawn`).

**Root cause:** Both context managers read the parent from the
contextvar (`current()`). There is no `parent_ctx=` parameter. Fan-out
patterns where the orchestrator owns the parent context but workers
run on a different task have no way to attach to the right parent
without fragile contextvar copying.

**Blast radius:** Forces every adopter to either serialize work onto
the orchestrator's task (defeats parallelism) or implement a private
contextvar copy dance (LynxCapital's `WorkerPool` does this).

**Recommended fix:** Add `parent_ctx: CaracalContext | None = None`
parameter to both `spawn()` and `delegate_to_spawn()`. When set, use
it as the parent regardless of contextvar state, and bind it for the
duration of the yielded child context.

## CP-4: `_load_resource_bindings_file` accepts unvalidated shapes

**Location:** `caracal/packages/sdk/python/caracalai_sdk/client.py`
(`_load_resource_bindings_file`).

**Root cause:** Loader accepts both a flat `{rid: url}` dict and a
list of `{resource_id, upstream_prefix}` records, with no schema
validation. Malformed entries are silently dropped; typos in keys
(`upstreamprefix`, `resource-id`) yield zero bindings without raising.

**Blast radius:** Same failure mode as CP-2: gateway returns 404 and
the operator has no clue why. Compounded by the fact that the empty
bindings list looks identical to "no resources configured at all".

**Recommended fix:** Define a `ResourceBindingSpec` pydantic / dataclass
schema, validate every entry, and raise `ValueError` listing every
malformed entry's source position.
