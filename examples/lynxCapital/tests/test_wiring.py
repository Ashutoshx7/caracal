"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Validates that agent tool wrappers reach their intended providers, including rail-based payment routing and multi-ERP selection.
"""
from __future__ import annotations

import pytest

from app.agents import tools as tool_fns
from app.services import partners


@pytest.fixture(autouse=True)
def _reset_partners():
    partners.reset()
    yield
    partners.reset()


def _provider_of(result: dict) -> str:
    return result.get("provider", "")


# --------------------------------------------------------------------------- #
# Rail-based payment routing reaches three distinct providers
# --------------------------------------------------------------------------- #
def test_rail_routes_card_to_meridian(providerlab):
    res = tool_fns.submit_payment("r", "a", "us-axiom-cloud", 100.0, "USD", "CARD", "ref-1")
    assert _provider_of(res) == "meridian-pay"


def test_rail_routes_ach_to_halcyon(providerlab):
    res = tool_fns.submit_payment("r", "a", "us-axiom-cloud", 100.0, "USD", "ACH", "ref-2")
    assert _provider_of(res) == "halcyon-bank"
    assert res["operation"] == "initiate_payment"


def test_rail_routes_wire_to_quetzal(providerlab):
    res = tool_fns.submit_payment("r", "a", "us-axiom-cloud", 100.0, "USD", "WIRE", "ref-3")
    assert _provider_of(res) == "quetzal-payouts"


# --------------------------------------------------------------------------- #
# ERP selection reaches both accounting back ends
# --------------------------------------------------------------------------- #
def test_erp_selector_routes_to_both(providerlab):
    ironbark = tool_fns.match_invoice("r", "a", "v1", "INV-1", 100.0, "USD", erp="ironbark")
    assert _provider_of(ironbark) == "ironbark-erp"
    tallyhall = tool_fns.match_invoice("r", "a", "v1", "INV-1", 100.0, "USD", erp="tallyhall")
    assert _provider_of(tallyhall) == "tallyhall-books"


def test_erp_auto_is_deterministic(providerlab):
    a = tool_fns.match_invoice("r", "a", "us-axiom-cloud", "INV-9", 100.0, "USD")
    b = tool_fns.match_invoice("r", "a", "us-axiom-cloud", "INV-9", 100.0, "USD")
    assert _provider_of(a) == _provider_of(b)
    assert _provider_of(a) in ("ironbark-erp", "tallyhall-books")


# --------------------------------------------------------------------------- #
# Previously-orphaned providers are now reachable through dedicated tools
# --------------------------------------------------------------------------- #
def test_procurement_requisition_flow(providerlab):
    res = tool_fns.create_requisition("r", "a", "engineering", 5000, "laptops")
    assert _provider_of(res) == "junction-procure"
    assert res["data"]["status"] in ("approved", "pending_approval")


def test_identity_directory_reachable(providerlab):
    res = tool_fns.list_approver_groups("r", "a")
    assert _provider_of(res) == "lumen-identity"
    assert "items" in res["data"]


def test_market_snapshot_reachable(providerlab):
    res = tool_fns.get_market_snapshot("r", "a", "USD/EUR")
    assert _provider_of(res) == "pulse-market"
    assert "mid" in res["data"]


def test_crm_activity_reachable(providerlab):
    res = tool_fns.log_supplier_activity("r", "a", "CONT-00001", "call")
    assert _provider_of(res) == "beacon-crm"


# --------------------------------------------------------------------------- #
# Tool-payload correctness fixes
# --------------------------------------------------------------------------- #
def test_quickbooks_match_creates_then_matches(providerlab):
    res = tool_fns.quickbooks_match_bill("r", "a", "QBV-001", "INV-7", 250.0, "USD")
    # Either the bill matched, or the vendor is unknown to QuickBooks (realistic 404).
    assert _provider_of(res) == "tallyhall-books"
    assert res["operation"] in ("create_bill", "match_bill")


def test_payment_status_reads_charge(providerlab):
    created = partners.call("meridian-pay", "create_charge",
                            {"amount": 500, "currency": "USD", "source": "tok_visa"})
    charge_id = created["data"]["chargeId"]
    res = tool_fns.get_payment_status("r", "a", charge_id)
    assert res["operation"] == "get_charge"
    assert res["data"]["chargeId"] == charge_id
