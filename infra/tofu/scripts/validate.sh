#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# OpenTofu validation harness: formatting plus offline validate of every
# environment root and module. Providers are resolved once per root with no
# backend so the harness never touches state or a cluster.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v tofu >/dev/null 2>&1 || { echo "opentofu (tofu) is required" >&2; exit 1; }

tofu fmt -check -recursive "${ROOT}"

for dir in "${ROOT}"/envs/*/ "${ROOT}"/modules/*/ "${ROOT}"/providers/*/*/; do
    echo "==> Validating ${dir}"
    tofu -chdir="${dir}" init -backend=false -input=false >/dev/null
    tofu -chdir="${dir}" validate
done

# Every provider adapter implements the same host contract. A caller that swaps
# one adapter for another must not have to rename an input or an output, so the
# contract is asserted rather than left to review.
echo "==> Checking host contract conformance"
contractInputs="name region machineSize diskGb userData adminUsername adminPublicKey ingressCidrs adminCidrs networkCidr dnsZone hostnames dnsTtl tags"
contractOutputs="publicIp hostId identityId hostnames"
for dir in "${ROOT}"/providers/*/host/; do
    provider="$(basename "$(dirname "${dir}")")"
    for name in ${contractInputs}; do
        grep -q "^variable \"${name}\"" "${dir}/variables.tf" || {
            echo "FAIL: ${provider} host adapter is missing contract input ${name}" >&2
            exit 1
        }
    done
    for name in ${contractOutputs}; do
        grep -q "^output \"${name}\"" "${dir}/outputs.tf" || {
            echo "FAIL: ${provider} host adapter is missing contract output ${name}" >&2
            exit 1
        }
    done
    echo "  ${provider}: host contract satisfied"
done

# validate never evaluates templatefile, so the rendered cloud-config is checked
# separately: a malformed host bootstrap only surfaces at first boot otherwise.
echo "==> Rendering caracalHost cloud-config"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
cat >"${WORK}/main.tf" <<EOF
module "host" {
  source         = "${ROOT}/modules/caracalHost"
  caracalVersion = "v0.2.1"
  envOverrides   = { CARACAL_OPEN_REGISTRATION = "false" }
  tlsProxy = {
    email  = "ops@example.com"
    routes = { "console.example.com" = "web", "sts.example.com" = "sts" }
  }
}
output "userData" { value = module.host.userData }
EOF
tofu -chdir="${WORK}" init -backend=false -input=false >/dev/null
tofu -chdir="${WORK}" apply -auto-approve >/dev/null
tofu -chdir="${WORK}" output -raw userData >"${WORK}/userData.yaml"

node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
const doc = parse(readFileSync('${WORK}/userData.yaml', 'utf8'))
const files = Object.fromEntries(doc.write_files.map((f) => [f.path, f.content]))

const caddyfile = files['/var/lib/caracal/proxy/Caddyfile']
if (!caddyfile) throw new Error('proxy Caddyfile missing')
for (const [host, port] of [['console.example.com', 3001], ['sts.example.com', 8080]]) {
  if (!caddyfile.includes(host)) throw new Error(\`route \${host} missing\`)
  if (!caddyfile.includes(\`127.0.0.1:\${port}\`)) throw new Error(\`\${host} must proxy to \${port}\`)
}

// A console origin that disagrees with the terminating hostname breaks
// credentialed requests, so the derived values are asserted, not assumed.
const env = files['/var/lib/caracal/caracal.env']
for (const line of [
  'CARACAL_WEB_URL=https://console.example.com',
  'CARACAL_WEB_ORIGIN=https://console.example.com',
  'CARACAL_STS_ISSUER_URL=https://sts.example.com',
  'CARACAL_AUTH_TRUST_PROXY=1',
  'CARACAL_OPEN_REGISTRATION=false',
]) {
  if (!env.includes(line)) throw new Error(\`caracal.env missing \${line}\`)
}
if (!doc.runcmd.some((c) => typeof c === 'string' && c.includes('caracalProxy'))) {
  throw new Error('proxy container is never started')
}
console.log('  cloud-config renders with proxy routes and matching public origins')
"

cat >"${WORK}/main.tf" <<EOF
module "host" {
  source         = "${ROOT}/modules/caracalHost"
  caracalVersion = "v0.2.1"
}
output "userData" { value = module.host.userData }
EOF
tofu -chdir="${WORK}" apply -auto-approve >/dev/null
tofu -chdir="${WORK}" output -raw userData >"${WORK}/plain.yaml"
node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
const doc = parse(readFileSync('${WORK}/plain.yaml', 'utf8'))
if (doc.write_files) throw new Error('no proxy and no overrides must write no files')
if (doc.runcmd.some((c) => typeof c === 'string' && c.includes('caracalProxy'))) {
  throw new Error('proxy must not start when tlsProxy is unset')
}
console.log('  cloud-config renders without a proxy when none is configured')
"

echo "tofu validation passed"
