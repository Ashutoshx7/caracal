# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Google Cloud results of the Caracal host contract.

# These four outputs are the shared host contract. Every provider adapter
# publishes the same names so callers stay provider-neutral.

output "publicIp" {
  description = "Public address the hostnames resolve to."
  value       = google_compute_address.caracal.address
}

output "hostId" {
  description = "Provider identifier of the host."
  value       = google_compute_instance.caracal.id
}

output "identityId" {
  description = "Cloud identity attached to the host, for granting access to a secret store or object storage."
  value       = google_service_account.caracal.email
}

output "hostnames" {
  description = "Names pointed at the host."
  value       = var.hostnames
}
