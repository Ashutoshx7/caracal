"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Tenant-aware Caracal SDK seam: the managed platform client, per-tenant DCR clients, and
the spawn, delegation, gateway, and verifier flows the application authorizes through.
"""
from __future__ import annotations

import os
import threading
from typing import Any

import httpx

# Caracal runtime client and authority primitives from the published SDK.
from caracalai_sdk import Caracal, CaracalContext, Grant
# Caracal verifier primitives used to authenticate inbound authority before serving
# internal providers.
from caracalai_identity import (
    JwtConfig,
    MANDATE_USE_RESOURCE,
    TokenInvalidError,
    ScopeInsufficientError,
    ZoneInvalidError,
    verify_config,
)

from app import tenancy

_lock = threading.Lock()
_client: Caracal | None = None
_built = False


def enabled() -> bool:
    """Caracal routing is active only when the managed platform identity is configured;
    absent that, the app falls back to the direct local provider path."""
    return bool(os.environ.get("CARACAL_ZONE_ID") and os.environ.get("CARACAL_APPLICATION_ID"))


def _allow_root() -> bool:
    """Bootstrap escape hatch: when set, upstream calls may use the platform's own
    service identity instead of a delegated agent mandate. Off by default so hot paths
    never silently leak root authority."""
    return os.environ.get("CARACAL_ALLOW_ROOT", "").strip().lower() in ("1", "true", "yes", "on")


def runtime() -> Caracal | None:
    """Build (once) and return the process-wide managed platform client, or None when
    the integration is not configured. This is the durable managed application that backs
    every tenant's agent sessions."""
    global _client, _built
    if not enabled():
        return None
    with _lock:
        if not _built:
            _client = Caracal.from_env()
            _built = True
        return _client


def tenant_client(application_id: str, client_secret: str, resources: list[str] | None = None) -> Caracal:
    """Build a client that authenticates as a tenant's DCR application — an isolated,
    auto-expiring credential boundary separate from the shared platform credential. The
    externally launched tenant workload holds these credentials and creates its single
    root session under them."""
    model = tenancy.load_model()
    resource_ids = resources or [spec.resourceId for spec in model.resources]
    return Caracal.from_client_secret(
        coordinator_url=os.environ.get("CARACAL_COORDINATOR_URL", "http://127.0.0.1:8085"),
        sts_url=os.environ.get("CARACAL_STS_URL", "http://127.0.0.1:8080"),
        zone_id=os.environ["CARACAL_ZONE_ID"],
        application_id=application_id,
        client_secret=client_secret,
        resources=resource_ids,
        gateway_url=os.environ.get("CARACAL_GATEWAY_URL", "http://127.0.0.1:8081"),
    )


async def aclose() -> None:
    """Release the SDK client's pooled transports and background token refresh."""
    global _client, _built
    with _lock:
        client, _client, _built = _client, None, False
    if client is not None:
        await client.close()


def context_middleware():
    """ASGI middleware factory that establishes the inbound Caracal context for each
    request so delegated authority propagates into the run, or None when off."""
    client = runtime()
    if client is None:
        return None
    return client.context_middleware(allow_root=_allow_root())


def spawn(**kwargs: Any):
    """Open a delegated agent context for a run so every downstream upstream call carries
    a scoped, non-root mandate. Returns an async context manager."""
    client = runtime()
    if client is None:
        return None
    return client.spawn(**kwargs)


def spawn_agent(tenant_id: str, role: str, *, parent_ctx: CaracalContext | None = None, ttl_seconds: int | None = None):
    """Spawn one tenant's role agent under the managed platform application.

    The agent session carries the `tenant:<id>` binding label and the role's capability
    labels (which the policy library keys on), the tenant id as a metadata correlation
    key, and a delegation edge narrowed to the role's least-privilege scope set. Spawning
    is the runtime unit; the durable credential boundary remains the one managed
    application. Returns an async context manager, or None when Caracal is not
    configured."""
    client = runtime()
    if client is None:
        return None
    labels = tenancy.agent_labels(tenant_id, role)
    scopes = tenancy.role_scopes(role)
    grant = Grant.narrow(scopes) if scopes else Grant.inherit()
    return client.spawn(
        grant=grant,
        labels=labels,
        metadata={"tenant_id": tenant_id, "role": role},
        parent_ctx=parent_ctx,
        ttl_seconds=ttl_seconds,
    )


def _envelope_headers(client: Caracal) -> dict[str, str]:
    """Project the active delegated context into Caracal envelope headers. Fails closed
    when no context is bound unless root identity is explicitly permitted, so a token is
    never leaked from a background task that escaped the request context."""
    return client.headers(allow_root=_allow_root())


def gateway_call(resource_id: str, operation: str, payload: dict, *, timeout_s: float = 6.0) -> httpx.Response:
    """Route an external provider operation through the Caracal upstream gateway.

    The gateway validates the Caracal envelope, selects the upstream by resource id,
    injects the provider credential it holds, and forwards the call — so the application
    itself never sees the third-party secret."""
    client = runtime()
    if client is None:
        raise RuntimeError("gateway_call requires Caracal to be configured")
    request = client.gateway_request(resource_id, f"/api/{operation}")
    headers = {**request.headers, **_envelope_headers(client)}
    with httpx.Client(timeout=timeout_s) as http:
        return http.post(request.url, json=payload, headers=headers)


def verify_internal(*, zone_id: str, audience: str, required_scopes: list[str] | None = None):
    """Authenticate the active authority for an internal provider using the Caracal
    verifier, then return its claims. Internal providers are not network-exposed, so
    authority is checked in-process here at their trust boundary rather than at a gateway."""
    client = runtime()
    if client is None:
        raise RuntimeError("verify_internal requires Caracal to be configured")
    headers = _envelope_headers(client)
    token = headers.get("Authorization", "")
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    config = JwtConfig(
        issuer=os.environ.get("CARACAL_ISSUER", os.environ.get("CARACAL_STS_URL", "")),
        audience=audience,
        expected_zone_id=zone_id,
        required_scopes=list(required_scopes or []),
        required_use=MANDATE_USE_RESOURCE,
    )
    return verify_config(token, config)


# Re-export the verifier's typed failures so callers can fail closed precisely.
VerifyErrors = (TokenInvalidError, ScopeInsufficientError, ZoneInvalidError)

__all__ = [
    "enabled",
    "runtime",
    "tenant_client",
    "aclose",
    "context_middleware",
    "spawn",
    "spawn_agent",
    "gateway_call",
    "verify_internal",
    "VerifyErrors",
    "CaracalContext",
]
