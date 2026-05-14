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
readonly REGISTRY="$CARACAL_REGISTRY"
readonly IMAGE_PREFIX="$CARACAL_IMAGE_PREFIX"
readonly REPO_ROOT="$(cd "$HERE/../.." && pwd)"
readonly COMPOSE_SRC="$REPO_ROOT/infra/docker/docker-compose.yml"

imageRef() {
  printf '%s/%s%s:v%s' "$REGISTRY" "$IMAGE_PREFIX" "$1" "$2"
}

validatePull() {
  local svc="$1" ver="$2"
  matchesOnly "$svc" || return 0
  local img; img="$(imageRef "$svc" "$ver")"
  if runOrEcho docker pull "$img" >/dev/null 2>&1; then
    logFinding "$AREA" "$img" "linux-amd64" "ghcr" "docker" "$SEV_INFO" "$STATUS_PASS" "image pulled" "docker pull $img"
  else
    logFinding "$AREA" "$img" "linux-amd64" "ghcr" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "docker pull failed" "docker pull $img"
  fi
}

validateStack() {
  matchesOnly "stack" || return 0
  if [[ ! -f "$COMPOSE_SRC" ]]; then
    logFinding "$AREA" "stack" "linux-amd64" "compose" "docker" "$SEV_MAJOR" "$STATUS_WARN" "docker-compose.yml not found" "ls $COMPOSE_SRC"
    return 0
  fi
  local dir; dir="$(mktemp -d)"
  cat >"$dir/stack.env" <<'EOF'
POSTGRES_USER=caracal
POSTGRES_PASSWORD=caracal-postrelease-postgres
POSTGRES_DB=caracal
REDIS_PASSWORD=caracal-postrelease-redis
ZONE_KEK=1111111111111111111111111111111111111111111111111111111111111111
AUDIT_HMAC_KEY=2222222222222222222222222222222222222222222222222222222222222222
STREAMS_HMAC_KEY=3333333333333333333333333333333333333333333333333333333333333333
CARACAL_ADMIN_TOKEN=caracal-postrelease-admin-token
EOF
  REG="$REGISTRY" PREFIX="$IMAGE_PREFIX" "$CARACAL_PYTHON" - "$MANIFEST" "$dir/docker-compose.release.yml" <<'PY'
import json, os, sys
manifest = json.load(open(sys.argv[1]))
out = open(sys.argv[2], "w")
out.write("services:\n")
for svc, ver in manifest["containers"].items():
    out.write(f"  {svc}:\n")
    out.write("    build: null\n")
    out.write(f"    image: {os.environ['REG']}/{os.environ['PREFIX']}{svc}:v{ver}\n")
    out.write("    pull_policy: never\n")
PY
  local i img
  for (( i = 0; i < ${#CONTAINER_NAMES[@]}; i++ )); do
    img="$(imageRef "${CONTAINER_NAMES[$i]}" "${CONTAINER_VERS[$i]}")"
    if ! runOrEcho docker pull "$img" >>"$dir/pull" 2>&1; then
      logFinding "$AREA" "stack" "linux-amd64" "compose" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 2000 "$dir/pull")" "docker pull $img"
      rm -rf "$dir"
      return 0
    fi
  done
  if ! runOrEcho docker compose --env-file "$dir/stack.env" -f "$COMPOSE_SRC" build postgres redis >"$dir/build" 2>&1; then
    logFinding "$AREA" "stack" "linux-amd64" "compose" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 2000 "$dir/build")" "docker compose build postgres redis"
    rm -rf "$dir"
    return 0
  fi
  if runOrEcho docker compose --env-file "$dir/stack.env" -f "$COMPOSE_SRC" -f "$dir/docker-compose.release.yml" up -d --no-build --pull never >"$dir/up" 2>&1; then
    sleep 5
    logFinding "$AREA" "stack" "linux-amd64" "compose" "docker" "$SEV_INFO" "$STATUS_PASS" "compose up succeeded" "docker compose up -d"
    runOrEcho docker compose --env-file "$dir/stack.env" -f "$COMPOSE_SRC" -f "$dir/docker-compose.release.yml" down -v >/dev/null 2>&1 || true
  else
    logFinding "$AREA" "stack" "linux-amd64" "compose" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 2000 "$dir/up")" "docker compose up -d"
    runOrEcho docker compose --env-file "$dir/stack.env" -f "$COMPOSE_SRC" -f "$dir/docker-compose.release.yml" down -v >/dev/null 2>&1 || true
  fi
  rm -rf "$dir"
}

for (( i = 0; i < ${#CONTAINER_NAMES[@]}; i++ )); do validatePull "${CONTAINER_NAMES[$i]}" "${CONTAINER_VERS[$i]}"; done
validateStack
