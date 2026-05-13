# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# caracalai_core — generic primitives shared across Caracal Python packages.

from .errors import CaracalError, ErrorCode
from .scope import has_scope

__all__ = ["CaracalError", "ErrorCode", "has_scope"]
