"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

HTTP client for the Zephyr Pay mock provider authenticating with an API key header.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx


class ZephyrError(RuntimeError):
    def __init__(self, status: int, body: dict):
        super().__init__(f"zephyr {status}: {body}")
        self.status = status
        self.body = body


@dataclass(frozen=True)
class Payout:
    id: str
    status: str
    raw: dict


class ZephyrPayClient:
    """Thin wrapper over the Zephyr Pay REST surface."""

    def __init__(self, api_key: str, base_url: str = "http://127.0.0.1:9414",
                 *, timeout: float = 5.0, http_client: httpx.Client | None = None):
        self._http = http_client or httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers={"X-Api-Key": api_key, "User-Agent": "zephyr-pay-sdk/1.0"},
        )

    def _post(self, path: str, payload: dict) -> dict:
        r = self._http.post(path, json=payload)
        if r.status_code >= 400:
            try:
                body = r.json()
            except Exception:
                body = {"error": r.text}
            raise ZephyrError(r.status_code, body)
        return r.json()

    def create_payout(self, amount: float, currency: str, destination: str) -> Payout:
        data = self._post("/api/create_payout",
                          {"amount": amount, "currency": currency, "destination": destination})
        received = data.get("received", {})
        return Payout(id=data.get("operation", "create_payout"), status="accepted", raw=data | received)

    def get_payout(self, payout_id: str) -> Payout:
        data = self._post("/api/get_payout", {"id": payout_id})
        return Payout(id=payout_id, status="settled", raw=data)

    def close(self) -> None:
        self._http.close()
