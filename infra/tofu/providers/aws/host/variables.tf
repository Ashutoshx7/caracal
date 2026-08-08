# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# AWS inputs for the Caracal host contract.

# Everything above the provider divider is the shared host contract and is
# identical in every provider adapter. AWS needs nothing beyond it.

variable "name" {
  description = "Name applied to the host and its supporting resources."
  type        = string
}

variable "region" {
  description = "Provider region the host runs in. Configure it on the aws provider in the calling root."
  type        = string
  default     = ""
}

variable "machineSize" {
  description = "Provider machine size for the host."
  type        = string
  default     = "m6i.xlarge"
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
  description = "Operating system account created for administrative access. Fixed to ubuntu on the published image."
  type        = string
  default     = "ubuntu"
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
  description = "Existing subnet to attach the host to. Empty creates a dedicated VPC, which suits a first deployment but not an environment with peering or egress control."
  type        = string
  default     = ""
}

variable "zone" {
  description = "Availability zone for the created subnet. Empty lets the platform choose."
  type        = string
  default     = ""
}

variable "diskType" {
  description = "Root volume type. gp3 suits the bundled database; gp2 is the older default."
  type        = string
  default     = "gp3"
}

variable "dnsZone" {
  description = "Provider-managed DNS zone that owns the hostnames, as a Route 53 hosted zone ID. Empty skips record creation."
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
