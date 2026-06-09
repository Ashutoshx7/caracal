"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Unit tests for the Lynx Capital identity model and Control provisioning-plan builders.
"""
from __future__ import annotations

from app import tenancy


def test_model_and_manifest_load():
    model = tenancy.load_model()
    assert model.platform.applicationName == "lynx-platform"
    assert {c.id for c in model.customers} == {"aurora", "borealis"}
    assert {c.plan for c in model.customers} == {"enterprise", "growth"}
    assert {r.identifier for r in model.resources} == {
        "resource://portfolio",
        "resource://research",
        "resource://compliance",
    }
    manifest = tenancy.load_manifest()
    assert manifest.capabilities_for("portfolio") == ["portfolio-read", "portfolio-write", "research-read"]


def test_provider_and_resource_commands_bind():
    model = tenancy.load_model()
    providers = tenancy.provider_commands(model)
    assert {c["flags"]["identifier"] for c in providers} == {"pf-mandate", "rs-mandate", "cp-mandate"}
    assert all(c["flags"]["kind"] == "caracal_mandate" for c in providers)

    provider_ids = {c["flags"]["identifier"]: f"cp_{c['flags']['identifier']}" for c in providers}
    resources = tenancy.resource_commands(model, provider_ids)
    assert {c["flags"]["identifier"] for c in resources} == {
        "resource://portfolio",
        "resource://research",
        "resource://compliance",
    }
    portfolio = next(c for c in resources if c["flags"]["identifier"] == "resource://portfolio")
    assert portfolio["flags"]["credential-provider-id"] == "cp_pf-mandate"
    assert portfolio["flags"]["scopes"] == ["portfolio:read", "portfolio:write", "portfolio:admin"]


def test_policy_commands_cover_the_library():
    model = tenancy.load_model()
    policies = tenancy.policy_commands(model)
    names = [c["flags"]["name"] for c in policies]
    assert names[0] == "00-base", "base policy must be authored first"
    for required in ("portfolio-write", "delegated-advisor", "emergency-access"):
        assert required in names
    assert all("package caracal.authz" in c["flags"]["content"] for c in policies)


def test_agent_labels_and_role_scopes_are_least_privilege():
    labels = tenancy.agent_labels("portfolio")
    assert labels == ["portfolio-read", "portfolio-write", "research-read"]
    assert not any(label.startswith("tenant:") for label in labels)

    scopes = tenancy.role_scopes("portfolio")
    assert "portfolio:write" in scopes
    assert "compliance:admin" not in scopes


def test_customer_metadata_carries_the_subject_correlation():
    metadata = tenancy.customer_metadata("aurora", "portfolio")
    assert metadata == {"customer_id": "aurora", "role": "portfolio"}
