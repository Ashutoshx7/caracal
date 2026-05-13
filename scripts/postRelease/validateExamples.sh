#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Runs the lynxCapital example against manifest-pinned @caracalai/* package versions.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="examples"
readonly REPO_ROOT="$(cd "$HERE/../.." && pwd)"
readonly SRC="$REPO_ROOT/examples/lynxCapital"
readonly PLAT="$(hostPlatform)"

run() {
  matchesOnly "lynxCapital" || return 0
  if [[ ! -d "$SRC" ]]; then
    logFinding "$AREA" "lynxCapital" "$PLAT" "pnpm" "-" "$SEV_INFO" "$STATUS_WARN" "example directory missing" "ls $SRC"
    return 0
  fi
  local dir; dir="$(mktemp -d)"
  cp -r "$SRC/." "$dir/"
  local pinJson; pinJson="$(python3 -c '
import json, os
print(json.dumps({k.removeprefix("V_"): v for k, v in os.environ.items() if k.startswith("V_")}))
' $(for k in "${!NPM_VER[@]}"; do printf 'V_%q=%s ' "$k" "${NPM_VER[$k]}"; done))"
  if [[ -f "$dir/package.json" ]]; then
    PINS="$pinJson" python3 - "$dir/package.json" <<'PY'
import json, os, sys
path = sys.argv[1]
pins = json.loads(os.environ["PINS"])
with open(path) as f: d = json.load(f)
for key in ("dependencies", "devDependencies"):
    deps = d.get(key, {})
    for name in list(deps):
        if name in pins:
            deps[name] = pins[name]
with open(path, "w") as f: json.dump(d, f, indent=2)
PY
  fi
  if ( cd "$dir" && runOrEcho pnpm install --silent ) >"$dir/install.log" 2>&1; then
    logFinding "$AREA" "lynxCapital" "$PLAT" "pnpm" "-" "$SEV_INFO" "$STATUS_PASS" "example install ok with manifest pins" "pnpm install"
  else
    logFinding "$AREA" "lynxCapital" "$PLAT" "pnpm" "-" "$SEV_MAJOR" "$STATUS_FAIL" "$(head -c 400 "$dir/install.log")" "pnpm install"
  fi
  rm -rf "$dir"
}

run
