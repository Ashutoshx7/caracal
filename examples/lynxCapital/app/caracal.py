"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Caracal SDK seam for the Lynx Capital swarm: per-application clients, worker spawning
under narrowed delegation edges, resource-mandate minting, and gateway-mediated calls.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

import httpx

from caracalai import Caracal, CaracalContext, DelegationConstraints, Grant

from app import tenancy

TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange"
STS_TOKEN_PATH = "/oauth/2/token"
WORKER_TTL_SECONDS = int(os.environ.get("LYNX_WORKER_TTL_SECONDS", "600"))
MANDATE_TTL_SECONDS = int(os.environ.get("LYNX_MANDATE_TTL_SECONDS", "300"))
MANDATE_REFRESH_LEEWAY_SECONDS = 30.0

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
    """One application boundary's bound runtime: its control-plane identity, its SDK
    client holding the session mandate, and the shared transport worker threads use to
    mint resource mandates and call the Gateway."""

    key: str
    application_id: str
    client_secret: str
    zone_id: str
    sts_url: str
    gateway_url: str
    client: Caracal
    http: httpx.Client
    views: list[str]

    def mint_mandate(
        self, ctx: CaracalContext, view_identifier: str, scopes: list[str]
    ) -> tuple[str, float]:
        """Exchange the application credential plus the agent's session and delegation
        edge for a resource mandate narrowed to one view and the requested scopes. The
        STS evaluates policy here with the delegation edge populated."""
        form = {
            "grant_type": TOKEN_EXCHANGE_GRANT,
            "zone_id": self.zone_id,
            "application_id": self.application_id,
            "client_secret": self.client_secret,
            "agent_session_id": ctx.agent_session_id or "",
            "delegation_edge_id": ctx.delegation_edge_id or "",
            "resource": view_identifier,
            "scope": " ".join(scopes),
            "ttl_seconds": str(MANDATE_TTL_SECONDS),
        }
        response = self.http.post(f"{self.sts_url}{STS_TOKEN_PATH}", data=form)
        response.raise_for_status()
        body = response.json()
        token = body.get("access_token")
        if not isinstance(token, str) or not token:
            raise RuntimeError(
                f"STS mandate exchange for {view_identifier} returned no access_token"
            )
        expires_in = body.get("expires_in")
        ttl = (
            float(expires_in)
            if isinstance(expires_in, (int, float))
            else float(MANDATE_TTL_SECONDS)
        )
        return token, time.time() + ttl


class WorkerAuthority:
    """One spawned agent's resource authority: its Caracal session context, its granted
    scope set, and a per-view mandate cache. Every partner call flows through here."""

    def __init__(
        self, runtime: AppRuntime, ctx: CaracalContext, role: str, scopes: list[str]
    ):
        self.runtime = runtime
        self.ctx = ctx
        self.role = role
        self.scopes = frozenset(scopes)
        self._mandates: dict[tuple[str, frozenset[str]], tuple[str, float]] = {}
        self._mandate_lock = threading.Lock()

    @property
    def application(self) -> str:
        return self.runtime.key

    @property
    def agent_session_id(self) -> str | None:
        return self.ctx.agent_session_id

    def allows(self, scope: str) -> bool:
        return scope in self.scopes

    def mandate(self, view_identifier: str, scopes: list[str]) -> str:
        key = (view_identifier, frozenset(scopes))
        with self._mandate_lock:
            cached = self._mandates.get(key)
            if cached and cached[1] - time.time() > MANDATE_REFRESH_LEEWAY_SECONDS:
                return cached[0]
            token, expiry = self.runtime.mint_mandate(
                self.ctx, view_identifier, sorted(scopes)
            )
            self._mandates[key] = (token, expiry)
            return token

    def gateway_post(
        self,
        view_identifier: str,
        path: str,
        payload: dict,
        scopes: list[str],
        *,
        timeout_s: float = 8.0,
    ) -> httpx.Response:
        """Call the provider behind a resource view through the Caracal Gateway. The
        Gateway validates the mandate, re-exchanges it against policy, injects the
        provider credential, and forwards the request; the worker never holds the
        partner secret."""
        token = self.mandate(view_identifier, scopes)
        return self.runtime.http.post(
            f"{self.runtime.gateway_url}{path}",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Caracal-Resource": view_identifier,
            },
            timeout=timeout_s,
        )


def _build_runtime(app_key: str, model: tenancy.TenancyModel) -> AppRuntime:
    application_id = _application_id(app_key)
    client_secret = _client_secret(app_key)
    if not application_id or not client_secret:
        raise RuntimeError(
            f"application {app_key} is missing LYNX_CARACAL_{_env_key(app_key)}_APPLICATION_ID "
            "or _CLIENT_SECRET; provision the zone and export the printed credentials"
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
        client_secret=client_secret,
        zone_id=zone_id,
        sts_url=sts_url,
        gateway_url=gateway_url,
        client=client,
        http=httpx.Client(timeout=10.0),
        views=views,
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
        app_runtime.http.close()
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
