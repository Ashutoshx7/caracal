#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Entry point for stable and rc Caracal release preparation.

set -euo pipefail

cd "$(dirname "$0")/.."
exec node scripts/release.mjs "$@"
