#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Verifies SLSA provenance and cosign signatures for every artifact pinned by the release manifest.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="provenance"
readonly REPO="${CARACAL_REPO:-caracalai/caracal}"
readonly REGISTRY="${CARACAL_REGISTRY:-ghcr.io/caracalai}"
readonly IDENT_RE="^https://github.com/$REPO"

readonly BINS=(caracal-linux-x64 caracal-linux-arm64 caracal-darwin-x64 caracal-darwin-arm64 caracal-windows-x64.exe)

verifyBinary() {
  local file="$1"
  matchesOnly "$file" || return 0
  if ! command -v gh >/dev/null 2>&1; then
    logFinding "$AREA" "$file" "github" "gh" "-" "$SEV_INFO" "$STATUS_WARN" "gh CLI not available" "gh attestation verify $file"
    return 0
  fi
  local dir; dir="$(mktemp -d)"
  if ! runOrEcho curl -fsSL -o "$dir/$file" "https://github.com/$REPO/releases/download/$CARACAL_RELEASE/$file"; then
    logFinding "$AREA" "$file" "github" "gh" "-" "$SEV_MAJOR" "$STATUS_FAIL" "download failed" "curl $file"
    rm -rf "$dir"; return 0
  fi
  if runOrEcho gh attestation verify "$dir/$file" --repo "$REPO" >"$dir/out" 2>&1; then
    logFinding "$AREA" "$file" "github" "gh" "-" "$SEV_INFO" "$STATUS_PASS" "attestation verified" "gh attestation verify $file --repo $REPO"
  else
    logFinding "$AREA" "$file" "github" "gh" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 400 "$dir/out")" "gh attestation verify $file --repo $REPO"
  fi
  rm -rf "$dir"
}

verifyImage() {
  local svc="$1" ver="$2"
  matchesOnly "$svc" || return 0
  if ! command -v cosign >/dev/null 2>&1; then
    logFinding "$AREA" "$svc" "ghcr" "cosign" "-" "$SEV_INFO" "$STATUS_WARN" "cosign not available" "cosign verify"
    return 0
  fi
  local img="$REGISTRY/$svc:v$ver"
  if runOrEcho cosign verify "$img" --certificate-identity-regexp "$IDENT_RE" --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null 2>&1; then
    logFinding "$AREA" "$img" "ghcr" "cosign" "-" "$SEV_INFO" "$STATUS_PASS" "image signature verified" "cosign verify $img"
  else
    logFinding "$AREA" "$img" "ghcr" "cosign" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "cosign verify failed" "cosign verify $img"
  fi
}

for b in "${BINS[@]}"; do verifyBinary "$b"; done
for s in "${!CONTAINER_VER[@]}"; do verifyImage "$s" "${CONTAINER_VER[$s]}"; done
