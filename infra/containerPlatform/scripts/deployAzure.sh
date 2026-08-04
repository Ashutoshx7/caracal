#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Applies rendered Azure Container Apps manifests in dependency order, running schema migrations to completion before any service rolls.

set -euo pipefail

MANIFEST_DIR="${1:-}"
RESOURCE_GROUP="${CARACAL_RESOURCE_GROUP:-}"

if [ -z "${MANIFEST_DIR}" ] || [ -z "${RESOURCE_GROUP}" ]; then
    echo "usage: CARACAL_RESOURCE_GROUP=<group> deployAzure.sh <renderedManifestDir>" >&2
    exit 1
fi

command -v az >/dev/null 2>&1 || { echo "the Azure CLI (az) is required" >&2; exit 1; }

jobTimeout="${CARACAL_JOB_TIMEOUT_SECONDS:-900}"

exists() {
    az "$@" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1
}

# Migrations are expand-only, so the previous release keeps serving while they
# apply. A failed migration must stop the rollout before any replica of the new
# release starts.
runJob() {
    local name="$1" manifest="$2"
    if exists containerapp job show --name "${name}"; then
        az containerapp job update --name "${name}" --resource-group "${RESOURCE_GROUP}" --yaml "${manifest}" >/dev/null
    else
        az containerapp job create --name "${name}" --resource-group "${RESOURCE_GROUP}" --yaml "${manifest}" >/dev/null
    fi

    local execution
    execution="$(az containerapp job start --name "${name}" --resource-group "${RESOURCE_GROUP}" --query name -o tsv)"
    echo "    execution ${execution}"

    local waited=0 status
    while :; do
        status="$(az containerapp job execution show --name "${name}" --job-execution-name "${execution}" \
            --resource-group "${RESOURCE_GROUP}" --query properties.status -o tsv)"
        case "${status}" in
            Succeeded) echo "    ${name}: succeeded"; return 0 ;;
            Failed|Degraded)
                echo "    ${name}: ${status}" >&2
                az containerapp job logs show --name "${name}" --job-execution-name "${execution}" \
                    --resource-group "${RESOURCE_GROUP}" --tail 100 >&2 || true
                return 1
                ;;
        esac
        if [ "${waited}" -ge "${jobTimeout}" ]; then
            echo "    ${name}: still ${status} after ${jobTimeout}s" >&2
            return 1
        fi
        sleep 5
        waited=$((waited + 5))
    done
}

rollApp() {
    local name="$1" manifest="$2"
    if exists containerapp show --name "${name}"; then
        az containerapp update --name "${name}" --resource-group "${RESOURCE_GROUP}" --yaml "${manifest}" >/dev/null
    else
        az containerapp create --name "${name}" --resource-group "${RESOURCE_GROUP}" --yaml "${manifest}" >/dev/null
    fi
    echo "    ${name}: revision provisioned"
}

for manifest in "${MANIFEST_DIR}"/*.yaml; do
    [ -e "${manifest}" ] || { echo "no manifests in ${MANIFEST_DIR}" >&2; exit 1; }
    file="$(basename "${manifest}" .yaml)"
    case "${file}" in
        *-job-*)
            name="caracal-${file#*-job-}"
            echo "==> job ${name}"
            runJob "${name}" "${manifest}"
            ;;
        *-app-*)
            name="caracal-${file#*-app-}"
            echo "==> app ${name}"
            rollApp "${name}" "${manifest}"
            ;;
    esac
done

echo "deploy ok: verify with CARACAL_SMOKE_HOST=<host> infra/scripts/smokeTest.sh"
