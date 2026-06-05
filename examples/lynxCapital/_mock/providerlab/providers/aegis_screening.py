"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Aegis Screening domain: sanctions, AML, and KYB party screening with watchlist hits and case resolution.
"""
from __future__ import annotations

from _mock.providerlab import intelligence
from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "aegis-screening"

_LISTS = ("OFAC SDN", "EU Consolidated", "UN Security Council", "HMT", "DPL")


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["screenings"] = {}
    state.tables["cases"] = {}


def _hits(name: str) -> list[dict]:
    rng = gen._rng(ID, "hits", name.lower())
    if rng.random() > 0.25:
        return []
    count = rng.randint(1, 3)
    out = []
    for _ in range(count):
        out.append({"list": rng.choice(_LISTS), "matchScore": round(rng.uniform(0.74, 0.99), 2),
                    "matchedName": name.upper(), "program": rng.choice(("SANCTIONS", "PEP", "ADVERSE_MEDIA"))})
    return out


@base.op(ID, "screen_party")
def screen_party(ctx: Ctx) -> dict:
    ctx.require_scope("screening.run")
    ctx.require("name")
    name = str(ctx.payload["name"])
    hits = _hits(name)
    decision = "clear" if not hits else ("review" if max(h["matchScore"] for h in hits) < 0.9 else "block")
    screening = {"screeningId": base.new_id("scr"), "name": name, "decision": decision,
                 "hits": hits, "createdAt": base.now()}
    ctx.state.table("screenings")[screening["screeningId"]] = screening
    if hits:
        case = {"caseId": base.new_id("case"), "screeningId": screening["screeningId"],
                "name": name, "status": "open", "hits": hits,
                "summary": intelligence.narrative(
                    "You are a sanctions analyst. Summarize the screening result in one sentence.",
                    f"Party {name} matched {len(hits)} watchlist entr{'y' if len(hits)==1 else 'ies'}.",
                    f"Potential match for {name} against {hits[0]['list']} ({hits[0]['program']}).")}
        ctx.state.table("cases")[case["caseId"]] = case
        screening["caseId"] = case["caseId"]
    return screening


@base.op(ID, "get_screening")
def get_screening(ctx: Ctx) -> dict:
    ctx.require_scope("cases.read")
    ctx.require("screeningId")
    rec = ctx.state.table("screenings").get(ctx.payload["screeningId"])
    if rec is None:
        raise DomainError(404, "screening_not_found", ctx.payload["screeningId"])
    return rec


@base.op(ID, "get_case")
def get_case(ctx: Ctx) -> dict:
    ctx.require_scope("cases.read")
    ctx.require("caseId")
    rec = ctx.state.table("cases").get(ctx.payload["caseId"])
    if rec is None:
        raise DomainError(404, "case_not_found", ctx.payload["caseId"])
    return rec


@base.op(ID, "resolve_case")
def resolve_case(ctx: Ctx) -> dict:
    ctx.require_scope("screening.run")
    ctx.require("caseId", "disposition")
    rec = ctx.state.table("cases").get(ctx.payload["caseId"])
    if rec is None:
        raise DomainError(404, "case_not_found", ctx.payload["caseId"])
    if ctx.payload["disposition"] not in ("false_positive", "true_match", "escalate"):
        raise DomainError(422, "invalid_disposition", "unknown disposition")
    if rec["status"] == "resolved":
        raise DomainError(409, "already_resolved", "case already resolved")
    rec["status"] = "resolved"
    rec["disposition"] = ctx.payload["disposition"]
    return rec
