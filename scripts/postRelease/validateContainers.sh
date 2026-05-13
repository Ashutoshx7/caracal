#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Pulls each Caracal container image at its manifest-pinned tag and boots them via docker-compose.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="containers"
readonly REGISTRY="${CARACAL_REGISTRY:-ghcr.io/caracalai}"
readonly REPO_ROOT="$(cd "$HERE/../.." && pwd)"
readonly COMPOSE_SRC="$REPO_ROOT/infra/docker/docker-compose.yml"

validatePull() {
  local svc="$1" ver="$2"
  matchesOnly "$svc" || return 0
  local img="$REGISTRY/$svc:v$ver"
  if runOrEcho docker pull "$img" >/dev/null 2>&1; then
    logFinding "$AREA" "$img" "linux-x64" "ghcr" "docker" "$SEV_INFO" "$STATUS_PASS" "image pulled" "docker pull $img"
  else
    logFinding "$AREA" "$img" "linux-x64" "ghcr" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "docker pull failed" "docker pull $img"
  fi
}

validateStack() {
  matchesOnly "stack" || return 0
  if [[ ! -f "$COMPOSE_SRC" ]]; then
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_MAJOR" "$STATUS_WARN" "docker-compose.yml not found" "ls $COMPOSE_SRC"
    return 0
  fi
  local dir; dir="$(mktemp -d)"
  cp "$COMPOSE_SRC" "$dir/docker-compose.yml"
  local pinJson; pinJson="$(python3 -c '
import json, os
print(json.dumps({k: os.environ["V_"+k] for k in os.environ if k.startswith("V_")}))
' $(for k in "${!CONTAINER_VER[@]}"; do printf 'V_%s=%s ' "$k" "${CONTAINER_VER[$k]}"; done))"
  REG="$REGISTRY" PINS="$pinJson" python3 - "$dir/docker-compose.yml" <<'PY'
import json, os, re, sys
path = sys.argv[1]
reg = os.environ["REG"]
pins = json.loads(os.environ["PINS"])
txt = open(path).read()
for svc, ver in pins.items():
    txt = re.sub(
        rf"(^\s*{svc}:\n(?:.*\n)*?\s*)(image:.*$)",
        lambda m, s=svc, v=ver: f"{m.group(1)}image: {reg}/{s}:v{v}",
        txt, count=1, flags=re.MULTILINE)
open(path, "w").write(txt)
PY
  if runOrEcho docker compose -f "$dir/docker-compose.yml" up -d >"$dir/up" 2>&1; then
    sleep 5
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_INFO" "$STATUS_PASS" "compose up succeeded" "docker compose up -d"
    runOrEcho docker compose -f "$dir/docker-compose.yml" down -v >/dev/null 2>&1 || true
  else
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 400 "$dir/up")" "docker compose up -d"
  fi
  rm -rf "$dir"
}

for s in "${!CONTAINER_VER[@]}"; do validatePull "$s" "${CONTAINER_VER[$s]}"; done
validateStack
