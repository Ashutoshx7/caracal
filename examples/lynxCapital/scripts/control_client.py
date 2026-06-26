"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Scoped Control-key client that drives Lynx Capital provisioning through the Control API.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

STS_TOKEN_PATH = "/oauth/2/token"
CONTROL_INVOKE_PATH = "/v1/control/invoke"

# The Control scopes the Lynx plan needs: applications, providers, resources, and the
# policy and policy-set lifecycle. The scoped key only ever receives the scopes the web console
# allowed it, so requesting these is safe even on a more restricted key.
SCOPES = [
    "control:app:read",
    "control:app:write",
    "control:app:delete",
    "control:identity-provider:read",
    "control:identity-provider:write",
    "control:identity-provider:delete",
    "control:resource:read",
    "control:resource:write",
    "control:resource:delete",
    "control:policy:read",
    "control:policy:write",
    "control:policy:delete",
    "control:policy-set:read",
    "control:policy-set:write",
]

# Operator provisioning environment is sourced separately from the workload .env; never
# load the managed application's runtime credentials here.
load_dotenv(Path(__file__).resolve().parent.parent / ".env.provision", override=False)


@dataclass
class ControlConfig:
    sts_url: str
    control_url: str
    audience: str
    client_id: str
    client_secret: str
    scopes: list[str] = field(default_factory=lambda: list(SCOPES))
    ttl_seconds: int | None = None


class ControlError(RuntimeError):
    pass


def config_from_env(env: dict[str, str] | None = None) -> ControlConfig:
    if env is None:
        env = dict(os.environ)
    missing = [
        name
        for name in ("CONTROL_CLIENT_ID", "CONTROL_CLIENT_SECRET")
        if not env.get(name, "").strip()
    ]
    if missing:
        raise ControlError(f"missing required environment values: {', '.join(missing)}")
    scopes = env.get("CONTROL_SCOPES", "").replace(",", " ").split()
    ttl = env.get("CONTROL_TTL_SECONDS", "").strip()
    return ControlConfig(
        sts_url=env.get("STS_URL", "http://127.0.0.1:8080").rstrip("/"),
        control_url=env.get("CONTROL_URL", "http://127.0.0.1:3000").rstrip("/"),
        audience=env.get("CONTROL_AUDIENCE", "caracal-control"),
        client_id=env["CONTROL_CLIENT_ID"],
        client_secret=env["CONTROL_CLIENT_SECRET"],
        scopes=scopes or list(SCOPES),
        ttl_seconds=int(ttl) if ttl else None,
    )


def _post(url: str, body: bytes, headers: dict[str, str]) -> dict:
    """POST with bounded retry on Control rate limiting, honoring the advertised window."""
    for attempt in range(4):
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            if exc.code == 429 and attempt < 3:
                retry_after = exc.headers.get("Retry-After", "")
                match = re.search(r"\d+", retry_after or detail)
                wait = min(int(match.group()) if match else 30, 120)
                print(f"rate limited; retrying in {wait}s", file=sys.stderr)
                time.sleep(wait + 1)
                continue
            raise ControlError(f"{url} -> {exc.code}: {detail}") from None
        except urllib.error.URLError as exc:
            raise ControlError(f"{url} unreachable: {exc.reason}") from None
    raise ControlError(f"{url} rate limited after retries")


class ControlClient:
    """Exchanges a scoped Control key for a short-lived STS token and invokes the zone-bound
    management catalog (`identity-provider`, `resource`, `policy`, `policy-set`) over
    `/v1/control/invoke`. The key is application-only and short-TTL; it can create the zone's
    objects but holds no runtime data authority."""

    def __init__(self, config: ControlConfig):
        self._config = config

    def token(self) -> str:
        # Control tokens are replay-protected (single-use JTI); mint one per invoke.
        form = {
            "grant_type": "client_credentials",
            "application_id": self._config.client_id,
            "client_secret": self._config.client_secret,
            "resource": self._config.audience,
            "scope": " ".join(self._config.scopes),
        }
        if self._config.ttl_seconds:
            form["ttl_seconds"] = str(self._config.ttl_seconds)
        result = _post(
            f"{self._config.sts_url}{STS_TOKEN_PATH}",
            urllib.parse.urlencode(form).encode("utf-8"),
            {"content-type": "application/x-www-form-urlencoded"},
        )
        access = result.get("access_token")
        if not access:
            raise ControlError("token exchange returned no access_token")
        return access

    def invoke(
        self, command: str, subcommand: str, flags: dict | None = None
    ) -> object:
        body = json.dumps(
            {"command": command, "subcommand": subcommand, "flags": flags or {}}
        ).encode("utf-8")
        result = _post(
            f"{self._config.control_url}{CONTROL_INVOKE_PATH}",
            body,
            {
                "content-type": "application/json",
                "authorization": f"Bearer {self.token()}",
            },
        )
        return result.get("result")

    def bound_zone(self) -> str:
        """The authoritative zone the Control key is bound to, read from the issued token's
        zone_id claim. Provisioning records this zone so the workload can detect and refuse a
        credential set that was minted for a different zone before it fails at token exchange."""
        zone = str(_jwt_claims(self.token()).get("zone_id", "")).strip()
        if not zone:
            raise ControlError("control token did not carry a zone_id claim")
        return zone

    def run(self, command: dict) -> object:
        """Invoke a plan command of the form built by app.tenancy."""
        return self.invoke(
            command["command"], command["subcommand"], command.get("flags")
        )


def _jwt_claims(token: str) -> dict:
    """Decode the claims segment of a compact JWS without verifying its signature. The token
    is issued by this deployment's STS to the caller, so reading its own zone_id claim needs
    no verification; the claim is only used to bind provisioning artifacts to a zone."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ControlError("control token is not a JWT")
    payload = parts[1]
    payload += "=" * (-len(payload) % 4)
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise ControlError(f"control token payload is unreadable: {exc}") from None
    if not isinstance(claims, dict):
        raise ControlError("control token payload is not an object")
    return claims


def find_by_identifier(items: object, identifier: str) -> dict | None:
    if isinstance(items, list):
        return next(
            (
                item
                for item in items
                if isinstance(item, dict) and item.get("identifier") == identifier
            ),
            None,
        )
    return None


def find_by_name(items: object, name: str) -> dict | None:
    if isinstance(items, list):
        return next(
            (
                item
                for item in items
                if isinstance(item, dict) and item.get("name") == name
            ),
            None,
        )
    return None
