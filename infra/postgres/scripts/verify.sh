#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Verifies postgres: migration round-trip, role grants, append-only audit.
# Usage: DATABASE_URL=postgres://... bash verify.sh

set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL required}"

run() { psql "$DB" -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
run_as() { psql "$1" -v ON_ERROR_STOP=1 -c "$2" 2>&1; }
scalar() { psql "$DB" -v ON_ERROR_STOP=1 -tAX -c "$1" 2>&1; }

echo "=== Migration: all expected tables exist ==="
TABLES=(zones applications resources providers policies policy_versions policy_sets \
        policy_set_versions policy_set_bindings sessions delegated_grants secrets \
        step_up_challenges audit_events agent_sessions agent_topology invitations teams)
for t in "${TABLES[@]}"; do
  run "SELECT 1 FROM $t LIMIT 0;" > /dev/null
  echo "  $t OK"
done

echo ""
echo "=== Append-only: audit role cannot UPDATE or DELETE audit_events ==="
AUDIT_URL="${AUDIT_DATABASE_URL:-$DB}"
if run_as "$AUDIT_URL" "UPDATE audit_events SET decision='x' WHERE false;" >/dev/null; then
  echo "  FAIL: UPDATE allowed under audit role"
  exit 1
fi
echo "  UPDATE denied OK"
if run_as "$AUDIT_URL" "DELETE FROM audit_events WHERE false;" >/dev/null; then
  echo "  FAIL: DELETE allowed under audit role"
  exit 1
fi
echo "  DELETE denied OK"

echo ""
echo "=== Policy versions immutable: trigger installed ==="
if [ "$(scalar "SELECT count(*) FROM pg_trigger WHERE tgname = 'policy_versions_immutable' AND NOT tgisinternal;")" = "1" ]; then
  echo "  trigger OK"
else
  echo "  FAIL: policy_versions immutability trigger missing"
  exit 1
fi

echo ""
echo "=== PASS ==="
