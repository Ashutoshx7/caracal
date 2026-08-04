# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# AWS results of the Caracal host contract.

# These four outputs are the shared host contract. Every provider adapter
# publishes the same names so callers stay provider-neutral.

output "publicIp" {
  description = "Public address the hostnames resolve to."
  value       = aws_eip.caracal.public_ip
}

output "hostId" {
  description = "Provider identifier of the host."
  value       = aws_instance.caracal.id
}

output "identityId" {
  description = "Cloud identity attached to the host, for granting access to a secret store or object storage."
  value       = aws_iam_role.caracal.arn
}

output "hostnames" {
  description = "Names pointed at the host."
  value       = var.hostnames
}
