"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Junction Procurement domain: procure-to-pay requisitions, approval routing, purchase orders, and budget checks.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "junction-procure"


@base.seeder(ID)
def seed(state: base.State) -> None:
    budgets = {}
    for dept in ("engineering", "operations", "marketing", "finance", "facilities"):
        rng = gen._rng(ID, "budget", dept)
        budgets[dept] = {"department": dept, "limit": round(rng.uniform(200_000, 2_000_000), 2),
                         "committed": 0.0}
    state.tables["budgets"] = budgets
    state.tables["requisitions"] = {}
    state.tables["purchase_orders"] = {}


@base.op(ID, "create_requisition")
def create_requisition(ctx: Ctx) -> dict:
    ctx.require_scope("procure.write")
    ctx.require("department", "amount", "description")
    budget = ctx.state.table("budgets").get(ctx.payload["department"])
    if budget is None:
        raise DomainError(404, "department_not_found", ctx.payload["department"])
    amount = float(ctx.payload["amount"])
    if amount <= 0:
        raise DomainError(422, "invalid_amount", "amount must be positive")
    req = {"requisitionId": base.new_id("req"), "department": ctx.payload["department"],
           "amount": amount, "description": ctx.payload["description"],
           "status": "pending_approval" if amount > 10_000 else "approved"}
    ctx.state.table("requisitions")[req["requisitionId"]] = req
    return req


@base.op(ID, "approve_requisition")
def approve_requisition(ctx: Ctx) -> dict:
    ctx.require_scope("procure.write")
    ctx.require("requisitionId")
    req = ctx.state.table("requisitions").get(ctx.payload["requisitionId"])
    if req is None:
        raise DomainError(404, "requisition_not_found", ctx.payload["requisitionId"])
    if req["status"] == "approved":
        raise DomainError(409, "already_approved", "requisition already approved")
    budget = ctx.state.table("budgets")[req["department"]]
    if budget["committed"] + req["amount"] > budget["limit"]:
        raise DomainError(402, "budget_exceeded", "approval exceeds department budget")
    budget["committed"] = round(budget["committed"] + req["amount"], 2)
    req["status"] = "approved"
    return req


@base.op(ID, "create_purchase_order")
def create_purchase_order(ctx: Ctx) -> dict:
    ctx.require_scope("procure.write")
    ctx.require("requisitionId", "vendorId")
    req = ctx.state.table("requisitions").get(ctx.payload["requisitionId"])
    if req is None:
        raise DomainError(404, "requisition_not_found", ctx.payload["requisitionId"])
    if req["status"] != "approved":
        raise DomainError(409, "requisition_not_approved", "requisition must be approved first")
    po = {"poId": base.new_id("po"), "requisitionId": req["requisitionId"],
          "vendorId": ctx.payload["vendorId"], "amount": req["amount"], "status": "issued"}
    ctx.state.table("purchase_orders")[po["poId"]] = po
    return po


@base.op(ID, "get_purchase_order")
def get_purchase_order(ctx: Ctx) -> dict:
    ctx.require_scope("procure.read")
    ctx.require("poId")
    po = ctx.state.table("purchase_orders").get(ctx.payload["poId"])
    if po is None:
        raise DomainError(404, "po_not_found", ctx.payload["poId"])
    return po


@base.op(ID, "get_budget")
def get_budget(ctx: Ctx) -> dict:
    ctx.require_scope("procure.read")
    ctx.require("department")
    budget = ctx.state.table("budgets").get(ctx.payload["department"])
    if budget is None:
        raise DomainError(404, "department_not_found", ctx.payload["department"])
    return {**budget, "available": round(budget["limit"] - budget["committed"], 2)}
