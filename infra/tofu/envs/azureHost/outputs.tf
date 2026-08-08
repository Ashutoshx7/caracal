# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Results needed to point DNS at the host and reach it.

output "publicIp" {
  description = "Address every hostname must resolve to. Create these records before the host finishes booting, or certificate issuance retries until they exist."
  value       = module.host.publicIp
}

output "hostnames" {
  description = "Names the host terminates TLS for."
  value       = module.host.hostnames
}

output "dnsRecords" {
  description = "Records to create when DNS is managed outside Azure."
  value       = [for host in module.host.hostnames : "${host}. A ${module.host.publicIp}"]
}

output "identityId" {
  description = "Managed identity attached to the host, for granting access to a secret store or object storage."
  value       = module.host.identityId
}
