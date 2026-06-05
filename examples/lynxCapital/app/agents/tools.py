"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Agent-callable tool wrappers that map each business action onto a real external provider over the partner integration layer.
"""
from __future__ import annotations

from typing import Callable

from app.events import types as ev
from app.events.bus import bus
from app.services.partners import PartnerPendingCaracal
from app.services.partners import call as _partner

_REGION_CCY = {"US": "USD", "IN": "USD", "DE": "EUR", "SG": "SGD", "BR": "BRL", "GLOBAL": "USD"}
_REGION_TAX = {"US": "US", "IN": "IN", "DE": "DE", "SG": "SG", "BR": "BR", "GLOBAL": "US"}


def _ccy(region: str) -> str:
    return _REGION_CCY.get(region, "USD")


def _run(run_id: str, agent_id: str, tool_name: str, provider_id: str,
         operation: str, payload: dict) -> dict[str, object]:
    """Emit the tool/service event pairs and execute one provider operation."""
    bus.publish(ev.tool_call(run_id, agent_id, tool_name, payload))
    bus.publish(ev.service_call(run_id, agent_id, provider_id, operation, payload))
    try:
        result = _partner(provider_id, operation, payload)
    except PartnerPendingCaracal:
        result = {"provider": provider_id, "operation": operation,
                  "status": "pending_caracal_integration",
                  "message": "provider activates in the Caracal SDK integration phase"}
    bus.publish(ev.service_result(run_id, agent_id, provider_id, operation, result))
    bus.publish(ev.tool_result(run_id, agent_id, tool_name, result))
    return result


# -- invoice-intake tools --

def extract_invoice(run_id: str, agent_id: str, invoice_id: str, document_ref: str) -> dict[str, object]:
    return _run(run_id, agent_id, "extract_invoice", "inkwell-ocr", "submit_document",
                {"fileName": document_ref, "reference": invoice_id})


def get_vendor_profile(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_vendor_profile", "atlas-vendor", "get_vendor_profile",
                {"vendorId": vendor_id})


def get_fx_rate(run_id: str, agent_id: str, from_currency: str, to_currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_fx_rate", "cordoba-fx", "get_quote",
                {"from": from_currency, "to": to_currency, "amount": 1})


# -- ledger-match tools (three accounting back ends) --

def netsuite_match_invoice(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "netsuite_match_invoice", "ironbark-erp", "match_invoice",
                {"invoiceId": invoice_id, "vendorId": vendor_id, "amount": amount, "currency": currency})


def netsuite_get_vendor_record(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "netsuite_get_vendor_record", "ironbark-erp", "get_vendor",
                {"vendorId": vendor_id})


def sap_match_invoice(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "sap_match_invoice", "ironbark-erp", "match_invoice",
                {"invoiceId": invoice_id, "vendorId": vendor_id, "amount": amount, "currency": currency})


def sap_get_vendor_record(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "sap_get_vendor_record", "ironbark-erp", "get_vendor",
                {"vendorId": vendor_id})


def quickbooks_match_bill(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "quickbooks_match_bill", "tallyhall-books", "create_bill",
                {"vendorId": vendor_id, "amount": amount, "currency": currency})


def quickbooks_get_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "quickbooks_get_vendor", "tallyhall-books", "get_vendor",
                {"vendorId": vendor_id})


# -- policy-check tools --

def check_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "check_vendor", "aegis-screening", "screen_party",
                {"name": vendor_id})


def check_transaction(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str, rail: str) -> dict[str, object]:
    return _run(run_id, agent_id, "check_transaction", "verafin-monitor", "monitor_transaction",
                {"transactionId": f"{vendor_id}:{rail}", "amount": amount, "currency": currency})


def get_withholding_rate(run_id: str, agent_id: str, region: str, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_withholding_rate", "sabre-tax", "get_jurisdiction",
                {"jurisdiction": _REGION_TAX.get(region, "US")})


def validate_tax_id(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "validate_tax_id", "sabre-tax", "validate_id",
                {"taxId": vendor_id, "country": "US"})


# -- route-optimization tools --

def get_account_balance(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_account_balance", "meridian-pay", "get_balance", {})


def get_quote(run_id: str, agent_id: str, from_currency: str, to_currency: str, amount: float) -> dict[str, object]:
    return _run(run_id, agent_id, "get_quote", "cordoba-fx", "get_quote",
                {"from": from_currency, "to": to_currency, "amount": amount})


# -- payment-execution tools (distinct rails) --

def submit_payment(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str, rail: str, reference: str) -> dict[str, object]:
    return _run(run_id, agent_id, "submit_payment", "meridian-pay", "create_payout",
                {"amount": amount, "currency": currency, "destination": vendor_id, "reference": reference})


def submit_payout(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str, rail: str, reference: str) -> dict[str, object]:
    return _run(run_id, agent_id, "submit_payout", "quetzal-payouts", "create_payout",
                {"recipientId": vendor_id, "amount": amount, "currency": currency})


def create_outbound_payment(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str, rail: str, reference: str) -> dict[str, object]:
    return _run(run_id, agent_id, "create_outbound_payment", "halcyon-bank", "initiate_payment",
                {"fromAccount": vendor_id, "amount": amount, "creditor": reference})


# -- audit tools --

def get_contract_terms(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_contract_terms", "atlas-vendor", "get_contract_terms",
                {"contractId": vendor_id})


def get_payment_status(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_payment_status", "meridian-pay", "get_balance", {})


# -- vendor lifecycle tools --

def kyb_screen_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "kyb_screen_vendor", "aegis-screening", "screen_party",
                {"name": vendor_id})


def register_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "register_vendor", "atlas-vendor", "register_vendor",
                {"name": vendor_id, "country": "US"})


def refresh_vendor_compliance(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "refresh_vendor_compliance", "atlas-vendor", "get_vendor_profile",
                {"vendorId": vendor_id})


# -- treasury tools --

def get_cash_position(run_id: str, agent_id: str, region: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_cash_position", "keystone-treasury", "get_position",
                {"currency": _ccy(region)})


def forecast_liquidity(run_id: str, agent_id: str, horizon_days: int) -> dict[str, object]:
    return _run(run_id, agent_id, "forecast_liquidity", "keystone-treasury", "forecast_liquidity",
                {"currency": "USD", "horizonDays": horizon_days})


def place_fx_hedge(run_id: str, agent_id: str, from_currency: str, to_currency: str, notional: float, tenor_days: int) -> dict[str, object]:
    return _run(run_id, agent_id, "place_fx_hedge", "keystone-treasury", "place_hedge",
                {"pair": f"{from_currency}/{to_currency}", "notional": notional, "side": "buy"})


def transfer_funds(run_id: str, agent_id: str, from_region: str, to_region: str, amount_usd: float) -> dict[str, object]:
    return _run(run_id, agent_id, "transfer_funds", "keystone-treasury", "transfer_funds",
                {"currency": "USD", "amount": amount_usd, "destination": to_region})


# -- close tools --

def post_journal_entry(run_id: str, agent_id: str, account_id: str, amount: float, currency: str, period: str) -> dict[str, object]:
    return _run(run_id, agent_id, "post_journal_entry", "slate-ledger", "post_entry",
                {"period": period, "lines": [{"debit": amount}, {"credit": amount}]})


def reconcile_account(run_id: str, agent_id: str, account_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "reconcile_account", "slate-ledger", "reconcile_account",
                {"accountId": account_id, "statementBalance": 0})


def compute_accrual(run_id: str, agent_id: str, category: str, period: str) -> dict[str, object]:
    return _run(run_id, agent_id, "compute_accrual", "slate-ledger", "compute_accrual",
                {"amount": 12000, "periods": 12, "category": category})


def close_period(run_id: str, agent_id: str, period: str) -> dict[str, object]:
    return _run(run_id, agent_id, "close_period", "slate-ledger", "close_period",
                {"period": period})


# -- compliance / regulatory tools --

def aml_monitor_transaction(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "aml_monitor_transaction", "verafin-monitor", "monitor_transaction",
                {"transactionId": vendor_id, "amount": amount, "currency": currency})


def sanctions_screen_batch(run_id: str, agent_id: str, batch_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "sanctions_screen_batch", "aegis-screening", "screen_party",
                {"name": batch_id})


def prepare_regulatory_filing(run_id: str, agent_id: str, filing_type: str, period: str) -> dict[str, object]:
    return _run(run_id, agent_id, "prepare_regulatory_filing", "verafin-monitor", "prepare_filing",
                {"alertId": period, "filingType": filing_type})


def attest_control(run_id: str, agent_id: str, control_id: str) -> dict[str, object]:
    return _run(run_id, agent_id, "attest_control", "verafin-monitor", "attest_control",
                {"controlId": control_id, "attestor": agent_id})


# -- receivables tools --

def issue_customer_invoice(run_id: str, agent_id: str, customer_id: str, amount: float, currency: str) -> dict[str, object]:
    return _run(run_id, agent_id, "issue_customer_invoice", "core-billing", "create_invoice",
                {"customerId": customer_id, "amount": amount})


def send_dunning_notice(run_id: str, agent_id: str, customer_id: str, stage: int) -> dict[str, object]:
    return _run(run_id, agent_id, "send_dunning_notice", "vela-notify", "send_message",
                {"channel": "email", "to": customer_id, "template": "dunning_reminder"})


def apply_customer_payment(run_id: str, agent_id: str, invoice_id: str, amount: float) -> dict[str, object]:
    return _run(run_id, agent_id, "apply_customer_payment", "core-billing", "apply_payment",
                {"invoiceId": invoice_id, "amount": amount})


def get_ar_aging(run_id: str, agent_id: str, region: str) -> dict[str, object]:
    return _run(run_id, agent_id, "get_ar_aging", "core-billing", "get_ar_aging", {})


# -- external partner integration tool --

def partner_operation(run_id: str, agent_id: str, provider_id: str, operation: str,
                      payload: dict[str, object] | None = None) -> dict[str, object]:
    args = {"provider_id": provider_id, "operation": operation, "payload": payload or {}}
    bus.publish(ev.tool_call(run_id, agent_id, "partner_operation", args))
    bus.publish(ev.service_call(run_id, agent_id, provider_id, operation, args["payload"]))
    try:
        result = _partner(provider_id, operation, payload or {})
    except PartnerPendingCaracal:
        result = {"provider": provider_id, "operation": operation,
                  "status": "pending_caracal_integration",
                  "message": "provider activates in the Caracal SDK integration phase"}
    bus.publish(ev.service_result(run_id, agent_id, provider_id, operation, result))
    bus.publish(ev.tool_result(run_id, agent_id, "partner_operation", result))
    return result


TOOLS: dict[str, Callable] = {
    "extract_invoice": extract_invoice,
    "get_vendor_profile": get_vendor_profile,
    "get_fx_rate": get_fx_rate,
    "netsuite_match_invoice": netsuite_match_invoice,
    "netsuite_get_vendor_record": netsuite_get_vendor_record,
    "sap_match_invoice": sap_match_invoice,
    "sap_get_vendor_record": sap_get_vendor_record,
    "quickbooks_match_bill": quickbooks_match_bill,
    "quickbooks_get_vendor": quickbooks_get_vendor,
    "check_vendor": check_vendor,
    "check_transaction": check_transaction,
    "get_withholding_rate": get_withholding_rate,
    "validate_tax_id": validate_tax_id,
    "get_account_balance": get_account_balance,
    "get_quote": get_quote,
    "submit_payment": submit_payment,
    "submit_payout": submit_payout,
    "create_outbound_payment": create_outbound_payment,
    "get_contract_terms": get_contract_terms,
    "get_payment_status": get_payment_status,
    "kyb_screen_vendor": kyb_screen_vendor,
    "register_vendor": register_vendor,
    "refresh_vendor_compliance": refresh_vendor_compliance,
    "get_cash_position": get_cash_position,
    "forecast_liquidity": forecast_liquidity,
    "place_fx_hedge": place_fx_hedge,
    "transfer_funds": transfer_funds,
    "post_journal_entry": post_journal_entry,
    "reconcile_account": reconcile_account,
    "compute_accrual": compute_accrual,
    "close_period": close_period,
    "aml_monitor_transaction": aml_monitor_transaction,
    "sanctions_screen_batch": sanctions_screen_batch,
    "prepare_regulatory_filing": prepare_regulatory_filing,
    "attest_control": attest_control,
    "issue_customer_invoice": issue_customer_invoice,
    "send_dunning_notice": send_dunning_notice,
    "apply_customer_payment": apply_customer_payment,
    "get_ar_aging": get_ar_aging,
    "partner_operation": partner_operation,
}
