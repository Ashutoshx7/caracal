# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Azure inputs for the Caracal host contract.

# Everything above the provider divider is the shared host contract and is
# identical in every provider adapter. Below it are the values only Azure needs.

variable "name" {
  description = "Name applied to the host and its supporting resources."
  type        = string
}

variable "region" {
  description = "Provider region the host runs in."
  type        = string
}

variable "machineSize" {
  description = "Provider machine size for the host."
  type        = string
  default     = "Standard_D4as_v5"
}

variable "diskGb" {
  description = "Size of the host's root disk in gigabytes. It holds the container images and all database and Redis state."
  type        = number
  default     = 128
}

variable "userData" {
  description = "Cloud-init user data, normally the userData output of the caracalHost module."
  type        = string
}

variable "adminUsername" {
  description = "Operating system account created for administrative access."
  type        = string
  default     = "caracaladmin"
}

variable "adminPublicKey" {
  description = "SSH public key authorised for the administrative account."
  type        = string
}

variable "ingressCidrs" {
  description = "Source ranges permitted to reach the host's HTTP and HTTPS ports."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "adminCidrs" {
  description = "Source ranges permitted to reach the host's SSH port. Leave empty to admit none."
  type        = list(string)
  default     = []
}

variable "networkCidr" {
  description = "Address range for the network the adapter creates for this host."
  type        = string
  default     = "10.60.0.0/16"
}

variable "dnsZone" {
  description = "Provider-managed DNS zone that owns the hostnames. Empty skips record creation."
  type        = string
  default     = ""
}

variable "hostnames" {
  description = "Fully qualified names to point at the host. They must match the routes the host's TLS proxy terminates."
  type        = list(string)
  default     = []
}

variable "dnsTtl" {
  description = "Time to live for the created DNS records."
  type        = number
  default     = 300
}

variable "tags" {
  description = "Tags applied to every resource the adapter creates."
  type        = map(string)
  default     = {}
}

# Azure-specific inputs.

variable "resourceGroupName" {
  description = "Existing resource group that holds the host and its supporting resources."
  type        = string
}

variable "dnsZoneResourceGroupName" {
  description = "Resource group holding the DNS zone. Defaults to the host's resource group."
  type        = string
  default     = ""
}
