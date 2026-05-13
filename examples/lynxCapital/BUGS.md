# Caracal SDK issues surfaced by the Lynx Capital integration

Real-world integration notes from wiring `caracalai-sdk` into the Lynx Capital
swarm. Each item is a friction point an end-user company will hit.

## 1. Parent → child `delegate()` is awkward across `asyncio.create_task` boundaries

`caracal.delegate(to=<child_session_id>, ...)` reads the *source* identity from
the active `current()` context. The intended flow is:

```
async with caracal.spawn(...) as child:
    async with caracal.delegate(to=child.agent_session_id, scopes=[...]):
        ...
```

This works when the parent stays in scope. In Lynx Capital, Finance Control
dispatches Regional/Workflow Orchestrators via `asyncio.create_task` (the
`JobRegistry.start` path) and returns immediately. The child task gets its own
spawn block — but by the time the child opens that block, Finance Control is
already off doing other work in its own task, so there is no natural place
for FC to call `delegate(to=child)` before the child needs it.

The current SDK shape forces one of these awkward workarounds:

- Pre-create the child session in the parent task, pass the resulting
  `agent_session_id` into the background coroutine, and have the child re-bind
  to that pre-existing session instead of calling `spawn()` itself. The SDK
  does not expose a "bind to existing session" entry point, so this isn't
  available.
- Have the parent block until the child reports its `agent_session_id` back,
  defeating the purpose of `asyncio.create_task`.

**Suggested SDK addition:** a single primitive that atomically spawns a child
*and* issues a delegation edge from the calling parent:

```python
async with caracal.delegate_to_spawn(kind=..., scopes=[...]) as child_ctx:
    ...  # runs as child, edge already recorded in coordinator
```

This is the missing ergonomic primitive for fan-out workflows.

For the Lynx integration we rely on the implicit parent→child lineage that
`spawn()` records (via the contextvar-propagated `parent_id`) and skip
explicit `delegate()` calls at the orchestrator boundary. Lineage is correct;
scope-narrowing is not enforced by Caracal yet for these edges.

## 2. `caracal.transport()` is async-only; sync `httpx.Client` users must inject headers manually

Lynx Capital's `RestClient` is built on a sync `httpx.Client` with retry,
breaker, idempotency, and submit-and-poll behavior. The SDK ships an
`httpx.AsyncClient` from `caracal.transport()` that auto-injects auth and
rewrites to the gateway — but there is no sync equivalent.

The integration falls back to merging `caracal.headers()` into the outbound
request manually inside `_do()`. This works, but it duplicates what
`caracal.transport()` does for async callers and skips automatic
gateway-rewrite.

**Suggested SDK addition:** `caracal.sync_transport() -> httpx.Client` with
the same auth-injection + gateway-rewrite behavior, or a
`caracal.gateway_url(resource_id, path)` helper for sync callers.

## 3. `Caracal.from_env()` parses `CARACAL_RESOURCES` as a flat env string

Each resource entry is `resource_id=upstream_prefix`, comma-separated. This is
fine for two or three resources, but Lynx Capital has 13 REST providers + 2
gRPC + 1 MCP. Splitting them across `.env` lines requires shell concatenation
or a single very long line — both error-prone.

**Suggested SDK addition:** accept either the flat form *or* a path to a JSON
file (`CARACAL_RESOURCES_FILE=...`) so resource maps can be version-controlled
without polluting `.env`.

## 4. Middleware must be installed at module load, not inside lifespan

`app.add_middleware(...)` only takes effect before Starlette's startup. That
means `caracal.middleware()` cannot live inside the `lifespan` async-context
manager — it has to run at import time. The current SDK README example
(`async with lifespan: caracal.init()`) is misleading for FastAPI users.

**Suggested doc fix:** the FastAPI section should show `Caracal.from_env()` at
module scope, followed by `app.add_middleware(caracal.middleware())` and a
note that startup-time init is wrong for ASGI middleware.
