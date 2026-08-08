# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Google Cloud inputs for the Caracal host contract.

# Everything above the provider divider is the shared host contract and is
# identical in every provider adapter. Below it are the values only Google Cloud
# needs.

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
  default     = "n2-standard-4"
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
  description = "Address range for the network the adapter creates. Ignored when subnetId is set."
  type        = string
  default     = "10.60.0.0/16"
}

variable "subnetId" {
  description = "Existing subnetwork to attach the host to. Requires networkId. Empty creates a dedicated network, which suits a first deployment but not a shared VPC."
  type        = string
  default     = ""
}

variable "zone" {
  description = "Zone within the region that runs the instance. Empty uses the region's first zone."
  type        = string
  default     = ""
}

variable "diskType" {
  description = "Boot disk type. pd-balanced suits the bundled database; pd-ssd raises IOPS."
  type        = string
  default     = "pd-balanced"
}

variable "dnsZone" {
  description = "Provider-managed DNS zone that owns the hostnames, as a Cloud DNS managed zone name. Empty skips record creation."
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
  description = "Labels applied to the host. Google Cloud labels accept lower-case keys and values only."
  type        = map(string)
  default     = {}
}

# Google Cloud specific inputs.

variable "networkId" {
  description = "Existing network holding subnetId. Firewall rules attach to a network rather than a subnetwork, so both are required together."
  type        = string
  default     = ""
}
