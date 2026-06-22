"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Caracal SDK seam for the Lynx Capital swarm: per-application clients, worker spawning
under narrowed delegation edges, resource-mandate minting, and gateway-mediated calls.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass

import httpx

from caracalai import (
    Caracal,
    CaracalContext,
    DelegationConstraints,
    Grant,
    ServiceAgent,
)

from app import tenancy

WORKER_TTL_SECONDS = int(os.environ.get("LYNX_WORKER_TTL_SECONDS", "600"))

_lock = threading.Lock()
_runtimes: dict[str, AppRuntime] | None = None


def _env_key(app_key: str) -> str:
    return app_key.upper().replace("-", "_")


def _service_url(name: str, default: str) -> str:
    return os.environ.get(name, default).rstrip("/")


def enabled() -> bool:
    """Caracal routing is active when the zone and the operations application identity are
    configured. Absent that, the swarm may only run in explicit simulation mode."""
    return bool(
        os.environ.get("CARACAL_ZONE_ID")
        and _application_id("operations")
        and os.environ.get("LYNX_CARACAL_OPERATIONS_CLIENT_SECRET")
    )


def _application_id(app_key: str) -> str:
    configured = os.environ.get(
        f"LYNX_CARACAL_{_env_key(app_key)}_APPLICATION_ID", ""
    ).strip()
    if configured:
        return configured
    provisioned = tenancy.load_provisioned().get("applications", {})
    entry = provisioned.get(app_key)
    return str(entry.get("application_id", "")) if isinstance(entry, dict) else ""


def _client_secret(app_key: str) -> str:
    return os.environ.get(f"LYNX_CARACAL_{_env_key(app_key)}_CLIENT_SECRET", "").strip()


def application_credentials(app_key: str) -> tuple[bool, bool]:
    """Whether an application boundary's id and client secret are configured."""
    return bool(_application_id(app_key)), bool(_client_secret(app_key))


@dataclass
class AppRuntime:
    """One application boundary's bound runtime: its control-plane identity and its SDK
    client holding the session mandate, resource-mandate minting, and gateway-routed
    transports."""

    key: str
    application_id: str
    zone_id: str
    gateway_url: str
    client: Caracal
    views: list[str]


class WorkerAuthority:
    """One spawned agent's resource authority: its Caracal session context and its
    granted scope set. Every partner call flows through here."""

    def __init__(
        self, runtime: AppRuntime, ctx: CaracalContext, role: str, scopes: list[str]
    ):
        self.runtime = runtime
        self.ctx = ctx
        self.role = role
        self.scopes = frozenset(scopes)

    @property
    def application(self) -> str:
        return self.runtime.key

    @property
    def agent_session_id(self) -> str | None:
        return self.ctx.agent_session_id

    def allows(self, scope: str) -> bool:
        return scope in self.scopes

    def gateway_post(
        self,
        view_identifier: str,
        path: str,
        payload: dict,
        scopes: list[str],
        *,
        timeout_s: float = 8.0,
        transport: httpx.BaseTransport | None = None,
    ) -> httpx.Response:
        """Call the provider behind a resource view through the Caracal Gateway. The
        SDK mints a cached resource mandate narrowed to this agent's session, delegation
        edge, and the requested scopes, then routes the request; the worker never holds
        the partner secret."""
        client = self.runtime.client
        request = client.gateway_request(view_identifier, path)
        kwargs: dict = {"timeout": timeout_s}
        if transport is not None:
            kwargs["transport"] = transport
        with client.sync_transport(ctx=self.ctx, scopes=scopes, **kwargs) as http:
            return http.post(request.url, json=payload, headers=request.headers)


def _build_runtime(app_key: str, model: tenancy.TenancyModel) -> AppRuntime:
    application_id = _application_id(app_key)
    client_secret = _client_secret(app_key)
    if not application_id or not client_secret:
        raise RuntimeError(
            f"application {app_key} is missing LYNX_CARACAL_{_env_key(app_key)}_APPLICATION_ID "
            "or _CLIENT_SECRET; run scripts/provision.py to generate config/provisioned.env"
        )
    zone_id = os.environ["CARACAL_ZONE_ID"]
    sts_url = _service_url("CARACAL_STS_URL", "http://localhost:8080")
    coordinator_url = _service_url("CARACAL_COORDINATOR_URL", "http://localhost:4000")
    gateway_url = _service_url("CARACAL_GATEWAY_URL", "http://localhost:8081")
    views = [resource.identifier for resource in model.application_resources(app_key)]
    client = Caracal.from_client_secret(
        coordinator_url=coordinator_url,
        sts_url=sts_url,
        zone_id=zone_id,
        application_id=application_id,
        client_secret=client_secret,
        resources=views,
        gateway_url=gateway_url,
    )
    return AppRuntime(
        key=app_key,
        application_id=application_id,
        zone_id=zone_id,
        gateway_url=gateway_url,
        client=client,
        views=views,
    )


def _assert_zone_consistency() -> None:
    """Fail fast when the workload's CARACAL_ZONE_ID disagrees with the zone its loaded
    credentials were provisioned for. The application ids and secrets in provisioned.env only
    authenticate inside their own zone, so running against another zone would otherwise fail
    later at token exchange instead of here, at startup, with a clear cause."""
    provisioned = os.environ.get("LYNX_CARACAL_ZONE_ID", "").strip()
    declared = os.environ.get("CARACAL_ZONE_ID", "").strip()
    if provisioned and declared and provisioned != declared:
        raise RuntimeError(
            f"CARACAL_ZONE_ID is {declared}, but config/provisioned.env was generated for zone "
            f"{provisioned}; the loaded application credentials only authenticate in {provisioned}. "
            f"Set CARACAL_ZONE_ID={provisioned}, or re-run scripts/provision.py against {declared}."
        )


def startup() -> None:
    """Build the per-application client registry. Fails closed: when Caracal is enabled,
    every application boundary must resolve its credentials."""
    global _runtimes
    if not enabled():
        return
    with _lock:
        if _runtimes is not None:
            return
        _assert_zone_consistency()
        model = tenancy.load_model()
        _runtimes = {
            app.id: _build_runtime(app.id, model) for app in model.applications
        }


def runtime(app_key: str) -> AppRuntime:
    if _runtimes is None:
        raise RuntimeError(
            "Caracal runtimes are not started; call caracal.startup() first"
        )
    try:
        return _runtimes[app_key]
    except KeyError:
        raise RuntimeError(f"unknown application boundary: {app_key!r}") from None


def runtimes() -> dict[str, AppRuntime]:
    return dict(_runtimes or {})


async def aclose() -> None:
    """Release every application client's pooled transports and token refresh."""
    global _runtimes
    with _lock:
        registry, _runtimes = _runtimes, None
    for app_runtime in (registry or {}).values():
        await app_runtime.client.aclose()


def worker_grant(
    scopes: list[str], views: list[str], *, ttl_seconds: int = WORKER_TTL_SECONDS
) -> Grant:
    """The least-privilege delegation grant for one worker: only the role's scopes, only
    the views those scopes live on, one hop, and a run-bounded TTL."""
    return Grant.narrow(
        sorted(scopes),
        constraints=DelegationConstraints(
            resources=sorted(views), max_hops=1, ttl_seconds=ttl_seconds
        ),
        ttl_seconds=ttl_seconds,
    )


__all__ = [
    "AppRuntime",
    "CaracalContext",
    "ServiceAgent",
    "WORKER_TTL_SECONDS",
    "WorkerAuthority",
    "aclose",
    "application_credentials",
    "enabled",
    "runtime",
    "runtimes",
    "startup",
    "worker_grant",
]
