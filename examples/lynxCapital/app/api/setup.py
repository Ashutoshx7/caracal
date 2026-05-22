"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Setup validation endpoint confirming OpenAI credentials and the Caracal stack are reachable.
"""
from __future__ import annotations

import os
import tomllib
from pathlib import Path

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

_CARACAL_ENV = (
    "CARACAL_COORDINATOR_URL",
    "CARACAL_GATEWAY_URL",
    "CARACAL_STS_URL",
)
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
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "caracal" / "caracal.toml"


def _config_status() -> tuple[bool, str]:
    path = _config_path()
    if not path.exists():
        return False, f"{path} not found. Create it from the values shown in caracal-console."
    try:
        cfg = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        return False, f"{path} is invalid TOML: {exc}"
    required = ("zone_id", "application_id", "app_client_secret")
    missing = [key for key in required if not isinstance(cfg.get(key), str) or not cfg.get(key)]
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
                  else "Missing — add it to .env or your shell.",
    })

    missing = [k for k in _CARACAL_ENV if not os.environ.get(k)]
    steps.append({
        "id": "caracal_env",
        "label": "Caracal env vars set",
        "ok": not missing,
        "detail": "All required CARACAL_* variables present." if not missing
                  else f"Missing: {', '.join(missing)}",
    })

    ok, detail = _config_status()
    steps.append({
        "id": "caracal_config",
        "label": "caracal.toml has Lynx resources",
        "ok": ok,
        "detail": detail,
    })

    coord = os.environ.get("CARACAL_COORDINATOR_URL", "")
    if coord:
        ok, detail = await _ping(coord.rstrip("/") + "/health")
        steps.append({"id": "caracal_coord", "label": "Caracal coordinator reachable",
                      "ok": ok, "detail": detail})
    else:
        steps.append({"id": "caracal_coord", "label": "Caracal coordinator reachable",
                      "ok": False, "detail": "CARACAL_COORDINATOR_URL not set."})

    gw = os.environ.get("CARACAL_GATEWAY_URL", "")
    if gw:
        ok, detail = await _ping(gw.rstrip("/") + "/health")
        steps.append({"id": "caracal_gateway", "label": "Caracal gateway reachable",
                      "ok": ok, "detail": detail})

    sts = os.environ.get("CARACAL_STS_URL", "")
    if sts:
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
