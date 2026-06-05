"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Public surface of the Terra Tax provider SDK shim.
"""
from .client import TerraTaxClient, TerraError, TaxResult

__all__ = ["TerraTaxClient", "TerraError", "TaxResult"]
