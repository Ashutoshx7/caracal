# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Azure results of the Caracal host contract.

# These four outputs are the shared host contract. Every provider adapter
# publishes the same names so callers stay provider-neutral.

output "publicIp" {
  description = "Public address the hostnames resolve to."
  value       = azurerm_public_ip.caracal.ip_address
}

output "hostId" {
  description = "Provider identifier of the host."
  value       = azurerm_linux_virtual_machine.caracal.id
}

output "identityId" {
  description = "Cloud identity attached to the host, for granting access to a secret store or object storage."
  value       = azurerm_user_assigned_identity.caracal.principal_id
}

output "hostnames" {
  description = "Names pointed at the host."
  value       = var.hostnames
}
