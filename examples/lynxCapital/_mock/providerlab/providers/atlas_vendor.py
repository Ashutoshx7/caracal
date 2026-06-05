"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Atlas Vendor Network domain: MCP tool server for vendor master-data lookup, registration, contracts, and search.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "atlas-vendor"


@base.seeder(ID)
def seed(state: base.State) -> None:
    vendors = gen.vendors(ID, 320)
    state.tables["vendors"] = gen.index_by(vendors)
    contracts = {}
    for i, v in enumerate(vendors, start=1):
        if i % 3 == 0:
            rng = gen._rng(ID, "contract", v["id"])
            cid = f"CTR-{i:05d}"
            contracts[cid] = {"id": cid, "vendorId": v["id"],
                              "value": round(rng.uniform(10_000, 2_000_000), 2),
                              "term": rng.choice(("12m", "24m", "36m")),
                              "renewal": rng.choice(("auto", "manual")),
                              "status": rng.choice(("active", "active", "expiring"))}
    state.tables["contracts"] = contracts


@base.op(ID, "get_vendor_profile")
def get_vendor_profile(ctx: Ctx) -> dict:
    ctx.require("vendorId")
    vendor = ctx.state.table("vendors").get(ctx.payload["vendorId"])
    if vendor is None:
        raise DomainError(404, "vendor_not_found", ctx.payload["vendorId"])
    return vendor


@base.op(ID, "register_vendor")
def register_vendor(ctx: Ctx) -> dict:
    ctx.require("name", "country")
    vendors = ctx.state.table("vendors")
    new_no = len(vendors) + 1
    vid = f"VEND-{new_no:05d}"
    vendor = {"id": vid, "name": ctx.payload["name"], "country": ctx.payload["country"],
              "currency": ctx.get("currency", "USD"), "status": "pending_review",
              "riskTier": "medium"}
    vendors[vid] = vendor
    return vendor


@base.op(ID, "get_contract_terms")
def get_contract_terms(ctx: Ctx) -> dict:
    ctx.require("contractId")
    contract = ctx.state.table("contracts").get(ctx.payload["contractId"])
    if contract is None:
        raise DomainError(404, "contract_not_found", ctx.payload["contractId"])
    return contract


@base.op(ID, "search_vendors")
def search_vendors(ctx: Ctx) -> dict:
    ctx.require("query")
    query = str(ctx.payload["query"]).lower()
    items = [v for v in ctx.state.table("vendors").values()
             if query in v["name"].lower() or query in v.get("country", "").lower()]
    return ctx.paginate(items, size_default=20)
