#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Downloads TUI release archives, verifies SHA256, and runs --version on the host-platform binary.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="tuiBinaries"
readonly KIND="tui"
readonly BIN="caracal-tui"
readonly BASE="https://github.com/$CARACAL_REPO/releases/download/$CARACAL_RELEASE"
readonly EXPECT="$TUI_VER"
readonly PLATS=(linux-amd64 linux-arm64 darwin-amd64 darwin-arm64 windows-amd64)

validatePlat() {
  local plat="$1"
  matchesOnly "$plat" || return 0
  local archiveExt=".tar.gz" binExt=""
  if [[ "$plat" == windows-* ]]; then archiveExt=".zip"; binExt=".exe"; fi
  local file="caracal-${KIND}-${plat}-${CARACAL_RELEASE}${archiveExt}"
  local dir; dir="$(mktemp -d)"
  if ! runOrEcho curl -fsSL -o "$dir/$file" "$BASE/$file"; then
    logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_BLOCKER" "$STATUS_FAIL" "download failed" "curl -fsSL $BASE/$file"
    rm -rf "$dir"; return 0
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
    if [[ "$archiveExt" == ".zip" ]]; then
      runOrEcho unzip -q -o "$dir/$file" -d "$dir/extract"
    else
      mkdir -p "$dir/extract"
      runOrEcho tar -xzf "$dir/$file" -C "$dir/extract"
    fi
  fi
  local binFile="$dir/extract/${BIN}${binExt}"
  if [[ "$plat" == "$(hostPlatform)" && "$DRY_RUN" != "1" ]]; then
    chmod +x "$binFile"
    if timeout 8 "$binFile" --version 2>"$dir/err" | grep -q "$EXPECT"; then
      logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_INFO" "$STATUS_PASS" "--version returns $EXPECT" "./${BIN}${binExt} --version"
    else
      logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_MAJOR" "$STATUS_FAIL" "$(head -c 200 "$dir/err")" "./${BIN}${binExt} --version"
    fi
  else
    logFinding "$AREA" "$file" "$plat" "github" "-" "$SEV_INFO" "$STATUS_PASS" "checksum ok; not host-executable" "sha256sum -c"
  fi
  rm -rf "$dir"
}

for p in "${PLATS[@]}"; do validatePlat "$p"; done
