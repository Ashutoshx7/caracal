#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Shared helpers and release-manifest loader for post-release validation sub-scripts.

set -euo pipefail

: "${CARACAL_RELEASE:?CARACAL_RELEASE must be set (e.g. v2026.05.13)}"
: "${FINDINGS_DIR:?FINDINGS_DIR must be set}"

readonly SEV_BLOCKER="blocker"
readonly SEV_MAJOR="major"
readonly SEV_MINOR="minor"
readonly SEV_INFO="info"

readonly STATUS_PASS="pass"
readonly STATUS_WARN="warn"
readonly STATUS_FAIL="fail"

readonly DRY_RUN="${DRY_RUN:-0}"

mkdir -p "$FINDINGS_DIR"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MANIFEST="${MANIFEST:-$REPO_ROOT/releases/$CARACAL_RELEASE/manifest.json}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "common.sh: manifest not found at $MANIFEST" >&2
  exit 2
fi

declare -A PYPI_VER NPM_VER CONTAINER_VER
CLI_VER=""
TUI_VER=""

eval "$(python3 - "$MANIFEST" <<'PY'
import json, shlex, sys
m = json.load(open(sys.argv[1]))
print(f'CLI_VER={shlex.quote(m["binaries"]["cli"])}')
print(f'TUI_VER={shlex.quote(m["binaries"]["tui"])}')
for k, v in m["containers"].items():
    print(f'CONTAINER_VER[{shlex.quote(k)}]={shlex.quote(v)}')
for k, v in m["pypi"].items():
    print(f'PYPI_VER[{shlex.quote(k)}]={shlex.quote(v)}')
for k, v in m["npm"].items():
    print(f'NPM_VER[{shlex.quote(k)}]={shlex.quote(v)}')
PY
)"

logFinding() {
  local area="$1" artifact="$2" platform="$3" pm="$4" runtime="$5" severity="$6" status="$7" evidence="$8" repro="$9"
  local file="$FINDINGS_DIR/${area}.jsonl"
  python3 -c '
import json, sys
print(json.dumps({
  "area": sys.argv[1], "artifact": sys.argv[2], "platform": sys.argv[3],
  "pm": sys.argv[4], "runtime": sys.argv[5], "severity": sys.argv[6],
  "status": sys.argv[7], "evidence": sys.argv[8], "repro": sys.argv[9]
}))
' "$area" "$artifact" "$platform" "$pm" "$runtime" "$severity" "$status" "$evidence" "$repro" >> "$file"
}

retryBackoff() {
  local attempts="${1:-10}" delay="${2:-120}"; shift 2
  local n=1
  until "$@"; do
    if (( n >= attempts )); then
      return 1
    fi
    sleep "$delay"
    n=$((n + 1))
  done
}

runOrEcho() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

matchesOnly() {
  local item="$1" only="${ONLY:-}"
  [[ -z "$only" ]] && return 0
  local IFS=','
  for entry in $only; do
    [[ "$item" == "$entry" ]] && return 0
  done
  return 1
}

hostPlatform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    msys*|mingw*|cygwin*) os="windows" ;;
  esac
  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
  esac
  printf '%s-%s' "$os" "$arch"
}
