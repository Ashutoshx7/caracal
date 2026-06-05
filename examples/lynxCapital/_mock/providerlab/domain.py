"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Stateful domain behavior for each mock provider so operations validate input, enforce scope, and return realistic third-party responses.
"""
from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field


class DomainError(Exception):
    """Raised when a domain operation rejects a request the way a real provider would."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass
class State:
    """Per-provider mutable domain state, isolated to one running provider app."""

    provider_id: str
    lock: threading.Lock = field(default_factory=threading.Lock)
    records: dict[str, dict] = field(default_factory=dict)
    jobs: dict[str, dict] = field(default_factory=dict)
    seq: int = 0

    def next_id(self, prefix: str) -> str:
        self.seq += 1
        return f"{prefix}_{self.seq:06d}"


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _require(payload: dict, *names: str) -> None:
    missing = [n for n in names if payload.get(n) in (None, "")]
    if missing:
        raise DomainError(422, "invalid_request", f"missing required field(s): {', '.join(missing)}")


def _scopes(principal: dict) -> set[str]:
    raw = principal.get("scope")
    if raw is None:
        return set()
    if isinstance(raw, str):
        return {s for s in raw.split() if s}
    return {str(s) for s in raw}


def _require_scope(principal: dict, scope: str) -> None:
    """Enforce OAuth/mandate scope. Providers without scopes (api key, bearer) skip this."""
    if principal.get("auth") in ("oauth", "caracal_mandate") and scope not in _scopes(principal):
        raise DomainError(403, "insufficient_scope", f"operation requires scope {scope!r}")


def dispatch(provider, state: State, operation: str, payload: dict, principal: dict) -> dict:
    """Resolve one domain operation against provider state, returning a realistic body."""
    handler = _HANDLERS.get(provider.resource_kind)
    if handler is None:
        raise DomainError(404, "unknown_resource", f"no domain for {provider.resource_kind}")
    with state.lock:
        return handler(provider, state, operation, payload, principal)


# --------------------------------------------------------------------------- #
# api_key pair: Aurum Pay (sync write + idempotency + funds) vs Quill OCR (async job + query key)
# --------------------------------------------------------------------------- #
def _payments(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "create_charge":
        _require(payload, "amount", "currency", "source")
        amount = float(payload["amount"])
        if amount <= 0:
            raise DomainError(422, "invalid_amount", "amount must be positive")
        if amount > 50000:
            raise DomainError(402, "insufficient_funds", "amount exceeds available balance")
        idem = payload.get("idempotencyKey")
        if idem and idem in state.records:
            return state.records[idem]
        charge = {
            "chargeId": _new_id("ch"),
            "status": "succeeded",
            "amount": amount,
            "currency": payload["currency"],
            "source": payload["source"],
            "createdAt": int(time.time()),
        }
        if idem:
            state.records[idem] = charge
        return charge
    if op == "get_balance":
        return {"available": 184230.55, "pending": 9120.00, "currency": "USD"}
    raise DomainError(404, "unknown_operation", op)


def _ocr(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "extract_document":
        _require(payload, "documentUrl")
        job_id = _new_id("job")
        state.jobs[job_id] = {
            "jobId": job_id,
            "status": "processing",
            "documentUrl": payload["documentUrl"],
            "createdAt": int(time.time()),
        }
        return {"jobId": job_id, "status": "processing", "pollAfterMs": 800}
    if op == "get_job":
        _require(payload, "jobId")
        job = state.jobs.get(payload["jobId"])
        if job is None:
            raise DomainError(404, "job_not_found", payload["jobId"])
        job["status"] = "completed"
        job["fields"] = {"invoiceNumber": "INV-4471", "total": 2480.00, "currency": "USD",
                         "confidence": 0.97}
        return job
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# bearer pair: Nimbus Ledger (double-entry validation 422) vs Vela Mail (202 accepted)
# --------------------------------------------------------------------------- #
def _ledger(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "post_entry":
        lines = payload.get("lines") or []
        if len(lines) < 2:
            raise DomainError(422, "unbalanced_entry", "a journal entry needs at least two lines")
        debit = sum(float(l.get("debit", 0)) for l in lines)
        credit = sum(float(l.get("credit", 0)) for l in lines)
        if round(debit - credit, 2) != 0:
            raise DomainError(422, "unbalanced_entry", f"debits {debit} != credits {credit}")
        entry_id = _new_id("je")
        state.records[entry_id] = {"entryId": entry_id, "posted": True, "debit": debit, "credit": credit}
        return state.records[entry_id]
    if op == "get_account":
        _require(payload, "accountId")
        return {"accountId": payload["accountId"], "balance": 75210.42, "currency": "USD",
                "type": "asset"}
    raise DomainError(404, "unknown_operation", op)


def _mail(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "send_message":
        _require(payload, "to", "subject")
        if "@" not in str(payload["to"]):
            raise DomainError(422, "invalid_recipient", "recipient must be an email address")
        message_id = _new_id("msg")
        state.records[message_id] = {"messageId": message_id, "status": "queued",
                                     "to": payload["to"], "subject": payload["subject"]}
        return {"messageId": message_id, "status": "accepted", "queuedAt": int(time.time())}
    if op == "get_message":
        _require(payload, "messageId")
        rec = state.records.get(payload["messageId"])
        if rec is None:
            raise DomainError(404, "message_not_found", payload["messageId"])
        rec["status"] = "delivered"
        return rec
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# oauth client-credentials pair: Helios FX (scope-gated convert) vs Orbit ERP (404 + audience)
# --------------------------------------------------------------------------- #
def _fx(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    rates = {"USD:EUR": 0.92, "USD:GBP": 0.79, "EUR:USD": 1.09, "GBP:USD": 1.27}
    if op == "get_quote":
        _require(payload, "from", "to")
        pair = f"{payload['from']}:{payload['to']}"
        rate = rates.get(pair)
        if rate is None:
            raise DomainError(404, "pair_unavailable", pair)
        return {"pair": pair, "rate": rate, "quotedAt": int(time.time()), "expiresInMs": 30000}
    if op == "convert":
        _require_scope(principal, "fx.convert")
        _require(payload, "from", "to", "amount")
        pair = f"{payload['from']}:{payload['to']}"
        rate = rates.get(pair)
        if rate is None:
            raise DomainError(404, "pair_unavailable", pair)
        amount = float(payload["amount"])
        return {"pair": pair, "rate": rate, "in": amount, "out": round(amount * rate, 2),
                "dealId": _new_id("fx")}
    raise DomainError(404, "unknown_operation", op)


def _erp(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    vendors = {"V-1001": {"vendorId": "V-1001", "name": "Northwind Components", "terms": "NET30"},
               "V-1002": {"vendorId": "V-1002", "name": "Contoso Logistics", "terms": "NET45"}}
    if op == "get_vendor":
        _require(payload, "vendorId")
        vendor = vendors.get(payload["vendorId"])
        if vendor is None:
            raise DomainError(404, "vendor_not_found", payload["vendorId"])
        return vendor
    if op == "create_bill":
        _require_scope(principal, "erp.write")
        _require(payload, "vendorId", "amount")
        if payload["vendorId"] not in vendors:
            raise DomainError(404, "vendor_not_found", payload["vendorId"])
        bill_id = _new_id("bill")
        return {"billId": bill_id, "status": "open", "vendorId": payload["vendorId"],
                "amount": float(payload["amount"])}
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# oauth auth-code pair: Corvus Bank (scope step-up) vs Lumen CRM (409 conflict)
# --------------------------------------------------------------------------- #
def _bank(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "list_accounts":
        return {"accounts": [
            {"accountId": "ACC-77", "name": "Operating", "balance": 412900.10, "currency": "USD"},
            {"accountId": "ACC-78", "name": "Reserve", "balance": 1200000.00, "currency": "USD"},
        ]}
    if op == "initiate_payment":
        _require_scope(principal, "payments.write")
        _require(payload, "fromAccount", "amount", "creditor")
        return {"paymentId": _new_id("pmt"), "status": "pending_authorization",
                "amount": float(payload["amount"]), "creditor": payload["creditor"]}
    raise DomainError(404, "unknown_operation", op)


def _crm(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "get_contact":
        _require(payload, "contactId")
        return {"contactId": payload["contactId"], "name": "Dana Whitfield",
                "email": "dana@aerolux.example", "stage": "customer"}
    if op == "update_deal":
        _require_scope(principal, "deals.write")
        _require(payload, "dealId", "version")
        current = state.records.get(payload["dealId"], {"version": 1})
        if int(payload["version"]) != int(current["version"]):
            raise DomainError(409, "version_conflict",
                              f"deal at version {current['version']}, not {payload['version']}")
        current["version"] = int(current["version"]) + 1
        current["dealId"] = payload["dealId"]
        state.records[payload["dealId"]] = current
        return {"dealId": payload["dealId"], "version": current["version"], "status": "updated"}
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# caracal_mandate pair: Atlas Treasury (scope write) vs Sentinel Compliance (screening decisions)
# --------------------------------------------------------------------------- #
def _treasury(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "get_position":
        return {"cashUsd": 8421000.55, "asOf": int(time.time()),
                "byRegion": {"US": 5100000, "EU": 2200000, "APAC": 1121000}}
    if op == "move_funds":
        _require_scope(principal, "treasury.write")
        _require(payload, "fromRegion", "toRegion", "amountUsd")
        return {"transferId": _new_id("trf"), "status": "executed",
                "amountUsd": float(payload["amountUsd"])}
    raise DomainError(404, "unknown_operation", op)


def _compliance(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "screen_party":
        _require_scope(principal, "screening.run")
        _require(payload, "name")
        name = str(payload["name"])
        hit = name.strip().lower() in ("oblast holdings", "red sea trading")
        return {"caseId": _new_id("case"), "name": name,
                "decision": "review" if hit else "clear",
                "matches": 2 if hit else 0, "screenedAt": int(time.time())}
    if op == "get_case":
        _require(payload, "caseId")
        return {"caseId": payload["caseId"], "status": "closed", "decision": "clear"}
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# internal pair: Core Billing (write + 404) vs Core Identity (paging)
# --------------------------------------------------------------------------- #
def _billing(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "create_invoice":
        _require(payload, "customerId", "amount")
        idem = payload.get("idempotencyKey")
        if idem and idem in state.records:
            return state.records[idem]
        invoice = {"invoiceId": _new_id("inv"), "status": "open",
                   "customerId": payload["customerId"], "amount": float(payload["amount"])}
        state.records[invoice["invoiceId"]] = invoice
        if idem:
            state.records[idem] = invoice
        return invoice
    if op == "get_invoice":
        _require(payload, "invoiceId")
        rec = state.records.get(payload["invoiceId"])
        if rec is None:
            raise DomainError(404, "invoice_not_found", payload["invoiceId"])
        return rec
    raise DomainError(404, "unknown_operation", op)


def _identity(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    users = [{"userId": f"U-{i}", "name": f"User {i}", "active": i % 7 != 0} for i in range(1, 26)]
    if op == "get_user":
        _require(payload, "userId")
        for u in users:
            if u["userId"] == payload["userId"]:
                return u
        raise DomainError(404, "user_not_found", payload["userId"])
    if op == "list_groups":
        page = int(payload.get("page", 1))
        size = 10
        start = (page - 1) * size
        window = users[start:start + size]
        return {"page": page, "pageSize": size, "total": len(users),
                "items": window, "hasMore": start + size < len(users)}
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# mcp pair: Forge (sync search) vs Relay (async job) — reached via tools/call
# --------------------------------------------------------------------------- #
def _mcp_tool(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if provider.id == "forge-mcp":
        if op == "search_catalog":
            query = str(payload.get("query", ""))
            return {"query": query, "results": [
                {"sku": "SKU-100", "name": "Standard Plan"},
                {"sku": "SKU-220", "name": "Enterprise Plan"},
            ]}
        if op == "create_ticket":
            _require(payload, "subject")
            return {"ticketId": _new_id("tkt"), "status": "open", "subject": payload["subject"]}
    if provider.id == "relay-mcp":
        if op == "dispatch_job":
            _require_scope(principal, "relay.invoke")
            job_id = _new_id("job")
            state.jobs[job_id] = {"jobId": job_id, "status": "queued"}
            return {"jobId": job_id, "status": "queued"}
        if op == "get_job":
            _require(payload, "jobId")
            job = state.jobs.get(payload["jobId"])
            if job is None:
                raise DomainError(404, "job_not_found", payload["jobId"])
            job["status"] = "succeeded"
            return job
    raise DomainError(404, "unknown_operation", op)


# --------------------------------------------------------------------------- #
# sdk pair: Zephyr Pay (payouts + min amount) vs Terra Tax (rate table + id validation)
# --------------------------------------------------------------------------- #
def _payouts(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    if op == "create_payout":
        _require(payload, "amount", "currency", "destination")
        amount = float(payload["amount"])
        if amount < 1.0:
            raise DomainError(422, "amount_too_small", "minimum payout is 1.00")
        return {"payoutId": _new_id("po"), "status": "pending", "amount": amount,
                "currency": payload["currency"], "destination": payload["destination"]}
    if op == "get_payout":
        _require(payload, "id")
        return {"payoutId": payload["id"], "status": "paid"}
    raise DomainError(404, "unknown_operation", op)


def _tax(provider, state: State, op: str, payload: dict, principal: dict) -> dict:
    rates = {"US-CA": 0.0825, "US-NY": 0.08875, "DE": 0.19, "SG": 0.09}
    if op == "calculate":
        _require(payload, "jurisdiction", "amount")
        rate = rates.get(str(payload["jurisdiction"]))
        if rate is None:
            raise DomainError(404, "jurisdiction_unknown", str(payload["jurisdiction"]))
        amount = float(payload["amount"])
        tax = round(amount * rate, 2)
        return {"jurisdiction": payload["jurisdiction"], "rate": rate, "amount": amount,
                "tax": tax, "total": round(amount + tax, 2)}
    if op == "validate_id":
        _require(payload, "taxId")
        tax_id = str(payload["taxId"])
        valid = len(tax_id) >= 9 and tax_id.replace("-", "").isalnum()
        return {"taxId": tax_id, "valid": valid,
                "reason": None if valid else "format_invalid"}
    raise DomainError(404, "unknown_operation", op)


_HANDLERS = {
    "payments": _payments,
    "ocr": _ocr,
    "ledger": _ledger,
    "mail": _mail,
    "fx": _fx,
    "erp": _erp,
    "bank": _bank,
    "crm": _crm,
    "treasury": _treasury,
    "compliance": _compliance,
    "billing": _billing,
    "identity": _identity,
    "mcp": _mcp_tool,
    "payouts": _payouts,
    "tax": _tax,
}
