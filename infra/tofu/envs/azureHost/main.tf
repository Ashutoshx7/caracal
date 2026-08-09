# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Azure VM environment: one host running the packaged Compose stack behind TLS.

# Composes the provider-agnostic bootstrap with the Azure host adapter. The
# bootstrap decides what Caracal runs; the adapter decides what Azure creates.
# Swapping cloud means changing the second module source and nothing else.

provider "azurerm" {
  features {}
  subscription_id = var.subscriptionId
}

# Console credentials come from Key Vault at boot through the host's managed
# identity, so no secret value ever enters OpenTofu state or cloud-init data.
# Directories are pre-created for the caracal user because the engine later
# tightens them as that user, and files land readable through the 0700 parent.
locals {
  consoleSecretsDir = "/var/lib/caracal/secrets/console"
  # Constructed instead of referenced because the host consumes this bootstrap's
  # output; it must match the "<name>-identity" naming in the Azure host adapter.
  identityResourceId = "/subscriptions/${var.subscriptionId}/resourceGroups/${var.resourceGroupName}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${var.name}-identity"
  imdsTokenCommand   = "curl -fsS -H Metadata:true 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net&msi_res_id=${local.identityResourceId}' | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"access_token\"])'"

  keyVaultFetch = length(var.keyVaultSecrets) == 0 ? [] : concat(
    [
      "install -d -o caracal -g caracal -m 0700 /var/lib/caracal/secrets",
      "install -d -o caracal -g caracal -m 0755 ${local.consoleSecretsDir}",
    ],
    [for key, uri in var.keyVaultSecrets :
      "kvToken=$(${local.imdsTokenCommand}) && curl -fsS -H \"Authorization: Bearer $kvToken\" '${uri}?api-version=7.4' | python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)[\"value\"])' >${local.consoleSecretsDir}/${key} && chown caracal:caracal ${local.consoleSecretsDir}/${key} && chmod 0444 ${local.consoleSecretsDir}/${key}"
    ],
  )

  keyVaultFileEnv = { for key, uri in var.keyVaultSecrets : "${key}_FILE" => "/run/caracalConsoleSecrets/${key}" }
}

module "bootstrap" {
  source = "../../modules/caracalHost"

  caracalVersion = var.caracalVersion
  tlsProxy       = var.tlsProxy
  envOverrides   = merge(var.envOverrides, local.keyVaultFileEnv)
  operatorEmails = var.operatorEmails
  extraRuncmd    = local.keyVaultFetch
}

module "host" {
  source = "../../providers/azure/host"

  name              = var.name
  region            = var.region
  zone              = var.zone
  resourceGroupName = var.resourceGroupName
  machineSize       = var.machineSize
  diskGb            = var.diskGb
  diskType          = var.diskType
  adminUsername     = var.adminUsername
  adminPublicKey    = var.adminPublicKey
  ingressCidrs      = var.ingressCidrs
  adminCidrs        = var.adminCidrs
  userData          = module.bootstrap.userData
  tags              = var.tags

  # Attach to an existing network when given, otherwise a dedicated one is
  # created alongside the host.
  subnetId    = var.subnetId
  networkCidr = var.networkCidr

  sourceImageId    = var.sourceImageId
  encryptionAtHost = var.encryptionAtHost

  # The names the proxy terminates are the names DNS must answer for, so both
  # come from the same declaration and cannot drift apart.
  hostnames = keys(var.tlsProxy.routes)

  # Empty unless a zone in this subscription owns the names. When DNS lives with
  # another provider, create the records there against the publicIp output.
  dnsZone                  = var.dnsZone
  dnsZoneResourceGroupName = var.dnsZoneResourceGroupName
}
