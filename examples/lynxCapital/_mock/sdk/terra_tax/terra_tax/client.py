"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

HTTP client for the Terra Tax mock provider authenticating with an API key header.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx


class TerraError(RuntimeError):
    def __init__(self, status: int, body: dict):
        super().__init__(f"terra {status}: {body}")
        self.status = status
        self.body = body


@dataclass(frozen=True)
class TaxResult:
    amount: float
    jurisdiction: str
    raw: dict


class TerraTaxClient:
    """Thin wrapper over the Terra Tax REST surface."""

    def __init__(self, api_key: str, base_url: str = "http://127.0.0.1:9415",
                 *, timeout: float = 5.0, http_client: httpx.Client | None = None):
        self._http = http_client or httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers={"X-Api-Key": api_key, "User-Agent": "terra-tax-sdk/1.0"},
        )

    def _post(self, path: str, payload: dict) -> dict:
        r = self._http.post(path, json=payload)
        if r.status_code >= 400:
            try:
                body = r.json()
            except Exception:
                body = {"error": r.text}
            raise TerraError(r.status_code, body)
        return r.json()

    def calculate(self, country: str, amount: float) -> TaxResult:
        data = self._post("/api/calculate", {"country": country, "amount": amount})
        return TaxResult(amount=amount, jurisdiction=country, raw=data)

    def validate_id(self, tax_id: str, country: str) -> bool:
        data = self._post("/api/validate_id", {"tax_id": tax_id, "country": country})
        return bool(data.get("ok"))

    def close(self) -> None:
        self._http.close()
