#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Render validation for the managed container platform adapters and their guardrails.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }

DIR="$(mktemp -d)"
trap 'rm -rf "${DIR}"' EXIT

render() {
    node "${ROOT}/render.mjs" --config "$1" --out "$2"
}

# Manifests carry an ordering prefix, so a unit is located by suffix rather than
# by an index the topology is free to change.
unit() {
    local match
    match="$(find "${DIR}/$1" -maxdepth 1 \( -name "*-$2-$3.yaml" -o -name "*-$2-$3.json" \) | head -1)"
    if [ -z "${match}" ]; then
        echo "FAIL: ${1}: no $2 manifest for $3" >&2
        exit 1
    fi
    echo "${match}"
}

echo "=== Render: every provider adapter ==="
for provider in azure aws gcp; do
    render "${ROOT}/examples/${provider}.yaml" "${DIR}/${provider}" >/dev/null 2>"${DIR}/${provider}.log"
    for name in sts gateway api audit coordinator web; do
        unit "${provider}" app "${name}" >/dev/null
    done
    unit "${provider}" job migrate >/dev/null
    unit "${provider}" job authmigrate >/dev/null
    echo "  ${provider}: six services and both migration jobs render"
done

echo ""
echo "=== Maturity: experimental adapters announce themselves ==="
for provider in aws gcp; do
    grep -q "experimental" "${DIR}/${provider}.log" || { echo "FAIL: ${provider} must warn that it is experimental" >&2; exit 1; }
done
if grep -q "experimental" "${DIR}/azure.log"; then
    echo "FAIL: azure is the tested reference and must not warn" >&2
    exit 1
fi
echo "  aws and gcp warn; azure does not"

echo ""
echo "=== Images: stock released images, selected by start command ==="
# The published images carry every role; a rendered manifest that referenced a
# per-service repository would mean the deployment needs its own build.
for provider in azure aws gcp; do
    for role in sts gateway audit; do
        manifest="$(unit "${provider}" app "${role}")"
        grep -q "caracal-go:v" "${manifest}" || { echo "FAIL: ${provider}/${role} must run the shared Go image" >&2; exit 1; }
        grep -q "/usr/local/bin/${role}" "${manifest}" || { echo "FAIL: ${provider}/${role} command must select its role" >&2; exit 1; }
    done
    for role in api coordinator; do
        manifest="$(unit "${provider}" app "${role}")"
        grep -q "caracal-node:v" "${manifest}" || { echo "FAIL: ${provider}/${role} must run the shared Node image" >&2; exit 1; }
        grep -q "/app/${role}/dist/main.js" "${manifest}" || { echo "FAIL: ${provider}/${role} command must select its role" >&2; exit 1; }
    done
done
echo "  every provider runs the shared images and selects the role by command"

echo ""
echo "=== Secrets: resolved from a provider secret manager, never materialised ==="
node --input-type=module -e "
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const read = (dir, file) => {
  const body = readFileSync(join(dir, file), 'utf8')
  return file.endsWith('.json') ? JSON.parse(body) : parse(body)
}
const manifests = (dir) => readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.json'))

for (const file of manifests('${DIR}/azure')) {
  const doc = read('${DIR}/azure', file)
  for (const secret of doc.properties.configuration.secrets ?? []) {
    if (secret.value !== undefined) throw new Error(\`azure/\${file}: \${secret.name} is a literal value\`)
    if (!secret.keyVaultUrl) throw new Error(\`azure/\${file}: \${secret.name} is not a vault reference\`)
  }
}

for (const file of manifests('${DIR}/aws')) {
  const doc = read('${DIR}/aws', file)
  for (const container of doc.containerDefinitions ?? []) {
    for (const secret of container.secrets ?? []) {
      if (!String(secret.valueFrom).startsWith('arn:aws:secretsmanager:')) {
        throw new Error(\`aws/\${file}: \${secret.name} is not a Secrets Manager reference\`)
      }
    }
  }
}

for (const file of manifests('${DIR}/gcp')) {
  const doc = read('${DIR}/gcp', file)
  const spec = doc.kind === 'Job' ? doc.spec.template.spec.template.spec : doc.spec.template.spec
  for (const volume of spec.volumes ?? []) {
    for (const item of volume.secret?.items ?? []) {
      if (!item.secret) throw new Error(\`gcp/\${file}: projected secret has no Secret Manager name\`)
    }
  }
}
console.log('  every adapter resolves credentials through its provider secret manager')
"

echo ""
echo "=== Secret delivery: the core picks the form each platform supports ==="
grep -q "DATABASE_URL_FILE" "$(unit azure app sts)" || { echo "FAIL: azure must project secret files" >&2; exit 1; }
grep -q "DATABASE_URL_FILE" "$(unit gcp app sts)" || { echo "FAIL: gcp must project secret files" >&2; exit 1; }
grep -q '"name": "DATABASE_URL"' "$(unit aws app sts)" || { echo "FAIL: aws must bind secret variables" >&2; exit 1; }
if grep -q "DATABASE_URL_FILE" "$(unit aws app sts)"; then
    echo "FAIL: aws cannot mount secret files and must not claim to" >&2
    exit 1
fi
echo "  azure and gcp project files; aws binds variables"

echo ""
echo "=== Ingress: internal services stay internal ==="
grep -q "external: false" "$(unit azure app audit)" || { echo "FAIL: azure audit must not be public" >&2; exit 1; }
grep -q "ingress: internal" "$(unit gcp app audit)" || { echo "FAIL: gcp audit must not be public" >&2; exit 1; }
if grep -q "loadBalancers" "${DIR}/aws/21-app-audit.service.json"; then
    echo "FAIL: aws audit must not attach a load balancer" >&2
    exit 1
fi
grep -q "loadBalancers" "${DIR}/aws/25-app-web.service.json" || { echo "FAIL: aws web must attach a load balancer" >&2; exit 1; }
echo "  audit stays internal on every provider; the browser tier is published"

echo ""
echo "=== Ordering: migrations apply before any service rolls ==="
for provider in azure aws gcp; do
    first_app="$(find "${DIR}/${provider}" -name '*-app-*' -printf '%f\n' | sort | head -1)"
    first_job="$(find "${DIR}/${provider}" -name '*-job-*' -printf '%f\n' | sort | head -1)"
    [ "${first_job}" \< "${first_app}" ] || { echo "FAIL: ${provider} jobs must sort before apps" >&2; exit 1; }
done
echo "  jobs sort ahead of apps on every provider"

echo ""
echo "=== Guardrails: invalid configuration is rejected at render time ==="
reject() {
    local label="$1" expect="$2" file="${DIR}/reject.yaml"
    if render "${file}" "${DIR}/reject-out" >"${DIR}/reject.log" 2>&1; then
        echo "FAIL: ${label} must be rejected" >&2
        exit 1
    fi
    grep -q "${expect}" "${DIR}/reject.log" || {
        echo "FAIL: ${label} rejected for the wrong reason:" >&2
        cat "${DIR}/reject.log" >&2
        exit 1
    }
    echo "  rejected: ${label}"
}

sed 's/^logLevel: info/logLevel: debug/' "${ROOT}/examples/azure.yaml" >"${DIR}/reject.yaml"
reject "debug logging in stable mode" "logLevel=debug is not permitted"

sed 's|web: https://console.example.com|web: http://console.example.com|' "${ROOT}/examples/azure.yaml" >"${DIR}/reject.yaml"
reject "plaintext public origin" "must be an https origin"

sed 's/^  version: .*/  version: ""/' "${ROOT}/examples/azure.yaml" >"${DIR}/reject.yaml"
reject "missing release version" "missing required config"

sed '/^  identityId:/d' "${ROOT}/examples/azure.yaml" >"${DIR}/reject.yaml"
reject "missing azure managed identity" "azure.identityId is required"

sed '/^  taskRoleArn:/d' "${ROOT}/examples/aws.yaml" >"${DIR}/reject.yaml"
reject "missing aws task role" "aws.taskRoleArn is required"

sed '/^  serviceAccount:/d' "${ROOT}/examples/gcp.yaml" >"${DIR}/reject.yaml"
reject "missing gcp service account" "gcp.serviceAccount is required"

sed 's/^target: .*/target: kubernetes/' "${ROOT}/examples/azure.yaml" >"${DIR}/reject.yaml"
reject "unknown target" "unknown target"

echo ""
echo "container platform validation passed"
