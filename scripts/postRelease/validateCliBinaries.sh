#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Downloads CLI binaries from the GitHub Release, verifies SHA256, and runs host-platform smoke checks.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="cliBinaries"
readonly REPO="${CARACAL_REPO:-caracalai/caracal}"
readonly BASE="https://github.com/$REPO/releases/download/$CARACAL_RELEASE"
readonly EXPECT="$CLI_VER"

readonly PLATS=(linux-x64 linux-arm64 darwin-x64 darwin-arm64 windows-x64)

validatePlat() {
  local plat="$1"
  matchesOnly "$plat" || return 0
  local ext=""; [[ "$plat" == windows-* ]] && ext=".exe"
  local file="caracal-${plat}${ext}"
  local dir; dir="$(mktemp -d)"
  local url="$BASE/$file"
  if ! runOrEcho curl -fsSL -o "$dir/$file" "$url"; then
    logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "download failed" "curl -fsSL $url"
    return 0
  fi
  if ! runOrEcho curl -fsSL -o "$dir/SHA256SUMS" "$BASE/SHA256SUMS"; then
    logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_MAJOR" "$STATUS_FAIL" "SHA256SUMS missing" "curl -fsSL $BASE/SHA256SUMS"
    rm -rf "$dir"; return 0
  fi
  if [[ "$DRY_RUN" != "1" ]]; then
    ( cd "$dir" && grep " $file\$" SHA256SUMS | sha256sum -c - >/dev/null ) || {
      logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "SHA256 mismatch" "sha256sum -c"
      rm -rf "$dir"; return 0
    }
  fi
  if [[ "$plat" == "$(hostPlatform)" && "$DRY_RUN" != "1" ]]; then
    chmod +x "$dir/$file"
    if "$dir/$file" --version 2>"$dir/err" | grep -q "$EXPECT"; then
      logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_INFO" "$STATUS_PASS" "--version returns $EXPECT" "./$file --version"
    else
      logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 200 "$dir/err")" "./$file --version"
    fi
  else
    logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_INFO" "$STATUS_PASS" "checksum ok; not host-executable" "sha256sum -c"
  fi
  rm -rf "$dir"
}

for p in "${PLATS[@]}"; do validatePlat "$p"; done
