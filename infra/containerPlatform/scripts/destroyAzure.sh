#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Removes the Caracal Container Apps and Jobs from an environment, leaving operator-owned resources untouched.

set -euo pipefail

MANIFEST_DIR="${1:-}"
RESOURCE_GROUP="${CARACAL_RESOURCE_GROUP:-}"

if [ -z "${MANIFEST_DIR}" ] || [ -z "${RESOURCE_GROUP}" ]; then
    echo "usage: CARACAL_RESOURCE_GROUP=<group> destroyAzure.sh <renderedManifestDir>" >&2
    exit 1
fi

command -v az >/dev/null 2>&1 || { echo "the Azure CLI (az) is required" >&2; exit 1; }

# Only what this deployment created is removed. The database, cache, registry,
# vault, and the environment itself are operator-owned and survive: deleting
# them here would destroy audit evidence and credentials along with the compute.
echo "This removes every Caracal container app and job in ${RESOURCE_GROUP}."
echo "Postgres, Redis, Key Vault, the registry, and the environment are left in place."
if [ "${CARACAL_ASSUME_YES:-}" != "1" ]; then
    printf 'Type the resource group name to confirm: '
    read -r reply
    [ "${reply}" = "${RESOURCE_GROUP}" ] || { echo "aborted" >&2; exit 1; }
fi

removed=0
for manifest in "${MANIFEST_DIR}"/*.yaml "${MANIFEST_DIR}"/*.json; do
    [ -e "${manifest}" ] || continue
    file="$(basename "${manifest}")"
    file="${file%.*}"
    case "${file}" in
        *-app-*)
            name="caracal-${file#*-app-}"
            if az containerapp show --name "${name}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
                echo "==> removing app ${name}"
                az containerapp delete --name "${name}" --resource-group "${RESOURCE_GROUP}" --yes >/dev/null
                removed=$((removed + 1))
            fi
            ;;
        *-job-*)
            name="caracal-${file#*-job-}"
            if az containerapp job show --name "${name}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
                echo "==> removing job ${name}"
                az containerapp job delete --name "${name}" --resource-group "${RESOURCE_GROUP}" --yes >/dev/null
                removed=$((removed + 1))
            fi
            ;;
    esac
done

echo "teardown ok: ${removed} resource(s) removed"
echo "note: verify the remaining spend in Cost Analysis; stores and the environment still bill."
