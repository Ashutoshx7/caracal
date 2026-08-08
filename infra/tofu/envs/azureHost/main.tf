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

module "bootstrap" {
  source = "../../modules/caracalHost"

  caracalVersion = var.caracalVersion
  tlsProxy       = var.tlsProxy
  envOverrides   = var.envOverrides
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
