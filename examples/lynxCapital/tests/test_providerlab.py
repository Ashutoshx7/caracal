"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Validates the provider mock lab taxonomy, per-category authentication, credential lifecycle, and isolation boundaries.
"""
from __future__ import annotations

import base64
import hashlib
import os
import re
import uuid
from pathlib import Path

os.environ.setdefault("PROVIDERLAB_FAST", "1")

import pytest
from fastapi.testclient import TestClient

from _mock.providerlab import catalog, credentials, mandate
from _mock.providerlab.app import build_app

LYNX_ROOT = Path(__file__).resolve().parents[1]


def client(provider_id: str) -> TestClient:
    return TestClient(build_app(catalog.get(provider_id)))


def seed(provider_id: str) -> dict:
    return credentials.load(provider_id).data["seed"]


# --------------------------------------------------------------------------- #
# Taxonomy completeness
# --------------------------------------------------------------------------- #
def test_taxonomy_complete():
    assert catalog.taxonomy_complete()
    assert len(catalog.CATALOG) == 16
    for category in catalog.CATEGORIES:
        assert len(catalog.BY_CATEGORY[category]) == 2


def test_every_category_covered():
    expected = {
        "api_key", "bearer_token", "oauth2_client_credentials",
        "oauth2_authorization_code", "caracal_mandate", "none", "mcp", "sdk",
    }
    assert {p.category for p in catalog.CATALOG} == expected


def test_ports_unique_and_local_range():
    ports = [p.port for p in catalog.CATALOG]
    assert len(ports) == len(set(ports))
    assert all(9400 <= port <= 9415 for port in ports)


# --------------------------------------------------------------------------- #
# api_key (header and query)
# --------------------------------------------------------------------------- #
def test_api_key_header_accept_and_reject():
    c = client("aurum-pay")
    key = seed("aurum-pay")["apiKey"]
    assert c.post("/api/get_balance", headers={"X-Api-Key": key}).status_code == 200
    assert c.post("/api/get_balance", headers={"X-Api-Key": "bad"}).status_code == 401
    assert c.post("/api/get_balance").status_code == 401


def test_api_key_query_accept_and_reject():
    c = client("quill-ocr")
    key = seed("quill-ocr")["apiKey"]
    assert c.post(f"/api/get_job?api_key={key}").status_code == 200
    assert c.post("/api/get_job?api_key=bad").status_code == 401


# --------------------------------------------------------------------------- #
# bearer_token (standard and custom header/scheme)
# --------------------------------------------------------------------------- #
def test_bearer_standard_header():
    c = client("nimbus-ledger")
    token = seed("nimbus-ledger")["bearerToken"]
    assert c.post("/api/get_account", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert c.post("/api/get_account", headers={"Authorization": "Bearer no"}).status_code == 401


def test_bearer_custom_header_scheme():
    c = client("vela-mail")
    token = seed("vela-mail")["bearerToken"]
    assert c.post("/api/get_message", headers={"X-Vela-Token": f"Token {token}"}).status_code == 200
    assert c.post("/api/get_message", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# --------------------------------------------------------------------------- #
# oauth2_client_credentials (basic and post)
# --------------------------------------------------------------------------- #
def test_oauth_client_credentials_basic():
    c = client("helios-fx")
    s = seed("helios-fx")
    basic = base64.b64encode(f"{s['clientId']}:{s['clientSecret']}".encode()).decode()
    tok = c.post("/oauth/token", data={"grant_type": "client_credentials", "scope": "fx.read"},
                 headers={"Authorization": "Basic " + basic})
    assert tok.status_code == 200
    access = tok.json()["access_token"]
    assert c.post("/api/get_quote", headers={"Authorization": f"Bearer {access}"}).status_code == 200
    assert c.post("/api/get_quote", headers={"Authorization": "Bearer no"}).status_code == 401


def test_oauth_client_credentials_post_and_bad_secret():
    c = client("orbit-erp")
    s = seed("orbit-erp")
    tok = c.post("/oauth/token", data={
        "grant_type": "client_credentials", "client_id": s["clientId"],
        "client_secret": s["clientSecret"], "scope": "erp.read",
    })
    assert tok.status_code == 200
    bad = c.post("/oauth/token", data={
        "grant_type": "client_credentials", "client_id": s["clientId"], "client_secret": "wrong",
    })
    assert bad.status_code == 401


# --------------------------------------------------------------------------- #
# oauth2_authorization_code (PKCE and refresh)
# --------------------------------------------------------------------------- #
def _authorize_code(c: TestClient, s: dict, challenge: str | None = None) -> str:
    data = {
        "client_id": s["clientId"],
        "redirect_uri": "http://127.0.0.1:8000/callback",
        "scope": "accounts.read",
        "state": "xyz",
    }
    if challenge:
        data["code_challenge"] = challenge
    r = c.post("/oauth/authorize", data=data, follow_redirects=False)
    return r.headers["location"].split("code=")[1].split("&")[0]


def test_oauth_authorization_code_pkce():
    c = client("corvus-bank")
    s = seed("corvus-bank")
    verifier = "verifier-abc123verifier-abc123verifier-xyz"
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    code = _authorize_code(c, s, challenge)
    tok = c.post("/oauth/token", data={
        "grant_type": "authorization_code", "code": code, "client_id": s["clientId"],
        "client_secret": s["clientSecret"], "code_verifier": verifier,
        "redirect_uri": "http://127.0.0.1:8000/callback",
    })
    assert tok.status_code == 200 and "access_token" in tok.json()

    code2 = _authorize_code(c, s, challenge)
    bad = c.post("/oauth/token", data={
        "grant_type": "authorization_code", "code": code2, "client_id": s["clientId"],
        "client_secret": s["clientSecret"], "code_verifier": "WRONG",
        "redirect_uri": "http://127.0.0.1:8000/callback",
    })
    assert bad.status_code == 400


def test_oauth_authorization_code_refresh():
    c = client("lumen-crm")
    s = seed("lumen-crm")
    code = _authorize_code(c, s)
    tok = c.post("/oauth/token", data={
        "grant_type": "authorization_code", "code": code, "client_id": s["clientId"],
        "client_secret": s["clientSecret"], "redirect_uri": "http://127.0.0.1:8000/callback",
    }).json()
    assert "refresh_token" in tok
    refreshed = c.post("/oauth/token", data={
        "grant_type": "refresh_token", "refresh_token": tok["refresh_token"],
    })
    assert refreshed.status_code == 200 and "access_token" in refreshed.json()


# --------------------------------------------------------------------------- #
# caracal_mandate (verifier SDK semantics)
# --------------------------------------------------------------------------- #
def _mint(provider_id: str, **overrides) -> str:
    store = credentials.load(provider_id)
    provider = catalog.get(provider_id)
    base = dict(
        zone=store.data["zone"],
        resource=provider.id,
        scopes=list(provider.scopes),
        subject="lynx-agent",
        session_id="sid_test",
        root_session_id="root_test",
        agent_session_id="agent_test" if provider.require_delegation else None,
        delegation_edge_id="edge_test" if provider.require_delegation else None,
        ttl_seconds=300,
    )
    base.update(overrides)
    claims = mandate.MandateClaims(**base)
    return mandate.sign(claims, store.data["signing_key"])


def test_mandate_valid_and_seed():
    c = client("atlas-treasury")
    token = seed("atlas-treasury")["mandate"]
    assert c.post("/api/get_position", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert c.post("/api/get_position", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_mandate_zone_mismatch_rejected():
    c = client("atlas-treasury")
    token = _mint("atlas-treasury", zone="wrong-zone")
    r = c.post("/api/get_position", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json()["error"] == "invalid_zone"


def test_mandate_insufficient_scope_rejected():
    c = client("atlas-treasury")
    token = _mint("atlas-treasury", scopes=[])
    r = c.post("/api/get_position", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json()["error"] == "insufficient_scope"


def test_mandate_delegation_required_rejected():
    c = client("sentinel-compliance")
    token = _mint("sentinel-compliance", agent_session_id=None, delegation_edge_id=None)
    r = c.post("/api/screen_party", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json()["error"] == "delegation_required"


def test_mandate_revocation_anchor():
    c = client("atlas-treasury")
    anchor = f"sid_{uuid.uuid4().hex[:12]}"
    token = _mint("atlas-treasury", session_id=anchor)
    assert c.post("/api/get_position", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    credentials.load("atlas-treasury").revoke_mandate_anchor(anchor)
    r = c.post("/api/get_position", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json()["error"] == "session_revoked"


# --------------------------------------------------------------------------- #
# none (internal)
# --------------------------------------------------------------------------- #
def test_internal_provider_needs_no_credential():
    c = client("core-billing")
    assert c.post("/api/get_invoice").status_code == 200
    assert seed("core-identity")["credential"] is None


# --------------------------------------------------------------------------- #
# mcp (bearer and mandate guarded)
# --------------------------------------------------------------------------- #
def _mcp_call(c: TestClient, headers: dict) -> int:
    return c.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers=headers).status_code


def test_mcp_bearer_guarded():
    c = client("forge-mcp")
    token = seed("forge-mcp")["bearerToken"]
    assert _mcp_call(c, {"Authorization": f"Bearer {token}"}) == 200
    assert _mcp_call(c, {"Authorization": "Bearer no"}) == 401


def test_mcp_mandate_guarded():
    c = client("relay-mcp")
    token = seed("relay-mcp")["mandate"]
    assert _mcp_call(c, {"Authorization": f"Bearer {token}"}) == 200
    assert _mcp_call(c, {}) == 401


# --------------------------------------------------------------------------- #
# sdk (api-key over HTTP, consumed by a pip SDK shim)
# --------------------------------------------------------------------------- #
def test_sdk_providers_authenticate():
    for pid in ("zephyr-pay", "terra-tax"):
        c = client(pid)
        key = seed(pid)["apiKey"]
        op = catalog.get(pid).operations[0]
        assert c.post(f"/api/{op}", headers={"X-Api-Key": key}).status_code == 200
        assert c.post(f"/api/{op}", headers={"X-Api-Key": "bad"}).status_code == 401


def test_sdk_shim_end_to_end():
    from zephyr_pay import ZephyrPayClient

    key = seed("zephyr-pay")["apiKey"]
    http = TestClient(build_app(catalog.get("zephyr-pay")), headers={"X-Api-Key": key})
    sdk = ZephyrPayClient(api_key=key, http_client=http)
    payout = sdk.create_payout(amount=10.0, currency="USD", destination="acct_1")
    assert payout.status == "accepted"


# --------------------------------------------------------------------------- #
# Credential lifecycle
# --------------------------------------------------------------------------- #
def test_api_key_lifecycle_create_and_revoke():
    store = credentials.load("aurum-pay")
    rec = store.create_api_key("ci-temp")
    assert store.valid_api_key(rec["apiKey"])
    assert store.revoke("apiKey", rec["keyId"])
    assert not store.valid_api_key(rec["apiKey"])


def test_control_ui_create_credential_via_form():
    c = client("aurum-pay")
    r = c.post("/__lab/api/create-credential", data={"kind": "apiKey", "label": "ui-temp"},
               follow_redirects=False)
    assert r.status_code == 303
    store = credentials.load("aurum-pay")
    created = [k for k in store.data["apiKeys"] if k["label"] == "ui-temp"]
    assert created and store.valid_api_key(created[0]["apiKey"])


# --------------------------------------------------------------------------- #
# UI pages render
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("path", ["/", "/__lab/credentials", "/__lab/clients", "/__lab/api-clients"])
def test_ui_pages_render(path):
    c = client("helios-fx")
    r = c.get(path)
    assert r.status_code == 200
    assert "Helios FX" in r.text


# --------------------------------------------------------------------------- #
# External-feel network behavior
# --------------------------------------------------------------------------- #
def test_responses_carry_external_headers():
    c = client("aurum-pay")
    r = c.post("/api/get_balance", headers={"X-Api-Key": seed("aurum-pay")["apiKey"]})
    assert "X-Request-Id" in r.headers
    assert r.headers.get("Server", "").startswith("AurumPay")


# --------------------------------------------------------------------------- #
# Isolation boundaries
# --------------------------------------------------------------------------- #
def _app_python_files() -> list[Path]:
    return list((LYNX_ROOT / "app").rglob("*.py"))


def test_no_mock_logic_leaks_outside_mock():
    for path in _app_python_files():
        text = path.read_text(encoding="utf-8")
        assert "providerlab" not in text, f"mock reference leaked into {path}"
        assert "from _mock" not in text and "import _mock" not in text, f"_mock import in {path}"


def test_caracal_sdk_fully_removed_from_app():
    forbidden = re.compile(r"caracalai_sdk|caracal_module|from caracalai|import caracalai")
    for path in _app_python_files():
        assert not forbidden.search(path.read_text(encoding="utf-8")), f"SDK residue in {path}"


def test_no_caracal_sdk_in_dependencies():
    for name in ("pyproject.toml", "requirements.lock", "uv.lock"):
        path = LYNX_ROOT / name
        if path.exists():
            assert "caracalai" not in path.read_text(encoding="utf-8"), f"caracalai dep in {name}"
