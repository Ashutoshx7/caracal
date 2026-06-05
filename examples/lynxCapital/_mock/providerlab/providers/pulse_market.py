"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Pulse Market Data domain: real-time FX instruments, point-in-time snapshots, and streamable rate ticks.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "pulse-market"


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["instruments"] = gen.index_by(gen.instruments(ID), key="symbol")


def _tick(symbol: str, base_mid: float, n: int) -> dict:
    rng = gen._rng(ID, "tick", symbol, n)
    mid = round(base_mid * (1 + rng.uniform(-0.002, 0.002)), 4)
    return {"symbol": symbol, "bid": round(mid * 0.9995, 4), "ask": round(mid * 1.0005, 4),
            "mid": mid, "seq": n}


@base.op(ID, "list_instruments")
def list_instruments(ctx: Ctx) -> dict:
    return {"items": list(ctx.state.table("instruments").values())}


@base.op(ID, "get_snapshot")
def get_snapshot(ctx: Ctx) -> dict:
    ctx.require("symbol")
    inst = ctx.state.table("instruments").get(ctx.payload["symbol"])
    if inst is None:
        raise DomainError(404, "instrument_not_found", ctx.payload["symbol"])
    return _tick(inst["symbol"], inst["mid"], 0)


@base.op(ID, "stream_rates")
def stream_rates(ctx: Ctx) -> dict:
    """Return a finite window of ticks; the SSE surface streams these as events."""
    ctx.require("symbol")
    inst = ctx.state.table("instruments").get(ctx.payload["symbol"])
    if inst is None:
        raise DomainError(404, "instrument_not_found", ctx.payload["symbol"])
    count = max(1, min(int(ctx.get("ticks", 10)), 50))
    return {"symbol": inst["symbol"],
            "ticks": [_tick(inst["symbol"], inst["mid"], n) for n in range(count)]}
