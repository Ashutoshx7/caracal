"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Setup validation endpoint confirming OpenAI credentials and the Caracal stack are reachable.
"""
from __future__ import annotations

import os
import sys
import tomllib
from pathlib import Path

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

_CARACAL_DEFAULTS = {
    "CARACAL_COORDINATOR_URL": "http://localhost:4000",
    "CARACAL_GATEWAY_URL": "http://localhost:8081",
    "CARACAL_STS_URL": "http://localhost:8080",
}
_REQUIRED_RESOURCES = {
    "lynx/mercury-bank",
    "lynx/wise-payouts",
    "lynx/stripe-treasury",
    "lynx/quickbooks",
    "lynx/netsuite",
    "lynx/sap-erp",
    "lynx/ocr-vision",
    "lynx/close-engine",
    "lynx/regulatory-filings",
    "lynx/customer-billing",
    "lynx/tax-rules",
    "lynx/compliance-nexus",
    "lynx/fx-rates",
    "lynx/treasury-ops",
    "lynx/vendor-portal",
}


def _config_path() -> Path:
    explicit = os.environ.get("CARACAL_CONFIG")
    if explicit:
        return Path(explicit)
    return _config_dir() / "caracal.toml"


def _config_dir() -> Path:
    explicit = os.environ.get("CARACAL_CONFIG_HOME")
    if explicit:
        return Path(explicit)
    xdg = os.environ.get("XDG_CONFIG_HOME")
    if xdg:
        return Path(xdg) / "caracal"
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Roaming") / "Caracal"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Caracal"
    return Path.home() / ".config" / "caracal"


def _safe_path_segment(value: str) -> str:
    safe = "".join(char if char.isalnum() or char in "._-" else "_" for char in value.strip()).strip("_")
    return safe or "default"


def _default_client_secret_path(zone_id: str, application_id: str) -> Path:
    return _config_dir() / "runtime" / _safe_path_segment(zone_id) / _safe_path_segment(application_id) / "client-secret"


def _config_status() -> tuple[bool, str]:
    path = _config_path()
    if not path.exists():
        return False, f"{path} not found. Create it from the values shown in caracal-console."
    try:
        cfg = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        return False, f"{path} is invalid TOML: {exc}"
    zone_id = cfg.get("zone_id")
    application_id = cfg.get("application_id")
    missing = [
        key
        for key, value in (("zone_id", zone_id), ("application_id", application_id))
        if not isinstance(value, str) or not value
    ]
    has_inline_secret = isinstance(cfg.get("app_client_secret"), str) and cfg.get("app_client_secret")
    has_secret_file = isinstance(cfg.get("app_client_secret_file"), str) and cfg.get("app_client_secret_file")
    has_default_secret_file = (
        isinstance(zone_id, str)
        and isinstance(application_id, str)
        and _default_client_secret_path(zone_id, application_id).exists()
    )
    if not has_inline_secret and not has_secret_file and not has_default_secret_file:
        missing.append("local client-secret")
    creds = cfg.get("credentials")
    if missing:
        return False, f"{path} missing: {', '.join(missing)}"
    if not isinstance(creds, list) or not creds:
        return False, f"{path} needs [[credentials]] entries for Lynx resources."
    bad = [
        str(i)
        for i, item in enumerate(creds, start=1)
        if not isinstance(item, dict) or not item.get("resource") or not item.get("upstream_prefix")
    ]
    if bad:
        return False, f"{path} has incomplete credentials at index: {', '.join(bad)}"
    resources = {item.get("resource") for item in creds if isinstance(item, dict)}
    missing_resources = sorted(_REQUIRED_RESOURCES - resources)
    if missing_resources:
        return False, f"{path} missing resource bindings: {', '.join(missing_resources)}"
    return True, f"{path} contains {len(creds)} resource bindings."


def _caracal_url(key: str) -> str:
    return os.environ.get(key) or _CARACAL_DEFAULTS[key]


async def _ping(url: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as http:
            r = await http.get(url)
        return (r.status_code < 500, f"{url} → {r.status_code}")
    except Exception as exc:
        return (False, f"{url} unreachable: {exc.__class__.__name__}")


@router.get("/validate")
async def validate_setup():
    steps: list[dict] = []

    api_key = os.environ.get("OPENAI_API_KEY", "")
    steps.append({
        "id": "openai_key",
        "label": "OPENAI_API_KEY set",
        "ok": bool(api_key),
        "detail": "Found in environment." if api_key
                  else "Missing: add it to .env or your shell.",
    })

    steps.append({
        "id": "caracal_urls",
        "label": "Caracal service URLs resolved",
        "ok": True,
        "detail": "Using explicit CARACAL_* URLs or local stack defaults.",
    })

    ok, detail = _config_status()
    steps.append({
        "id": "caracal_config",
        "label": "caracal.toml has Lynx resources",
        "ok": ok,
        "detail": detail,
    })

    coord = _caracal_url("CARACAL_COORDINATOR_URL")
    ok, detail = await _ping(coord.rstrip("/") + "/health")
    steps.append({"id": "caracal_coord", "label": "Caracal coordinator reachable",
                  "ok": ok, "detail": detail})

    gw = _caracal_url("CARACAL_GATEWAY_URL")
    ok, detail = await _ping(gw.rstrip("/") + "/health")
    steps.append({"id": "caracal_gateway", "label": "Caracal gateway reachable",
                  "ok": ok, "detail": detail})

    sts = _caracal_url("CARACAL_STS_URL")
    ok, detail = await _ping(sts.rstrip("/") + "/health")
    steps.append({"id": "caracal_sts", "label": "Caracal STS reachable",
                  "ok": ok, "detail": detail})

    from app.api.hooks import required_secret_envs
    missing_secrets = [k for k in required_secret_envs() if not os.environ.get(k)]
    steps.append({
        "id": "webhook_secrets",
        "label": "Webhook signing secrets set",
        "ok": not missing_secrets,
        "detail": "All provider hook secrets present." if not missing_secrets
                  else f"Missing: {', '.join(missing_secrets)}",
    })

    overall = all(s["ok"] for s in steps)
    return JSONResponse({"ok": overall, "steps": steps})
