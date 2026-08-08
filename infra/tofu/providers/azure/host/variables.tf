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
  description = "Address range for the network the adapter creates. Ignored when subnetId is set."
  type        = string
  default     = "10.60.0.0/16"
}

variable "subnetId" {
  description = "Existing subnet to attach the host to. Empty creates a dedicated network, which suits a first deployment but not an environment with peering, private endpoints, or egress control."
  type        = string
  default     = ""
}

variable "zone" {
  description = "Availability zone for the host and its address. Empty lets the platform choose. A zone pins the host and its disk together, so recovery means recreating in the same zone."
  type        = string
  default     = ""
}

variable "diskType" {
  description = "Root disk storage class. Premium_LRS suits the bundled database; StandardSSD_LRS is cheaper for evaluation."
  type        = string
  default     = "Premium_LRS"
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

variable "osImage" {
  description = "Marketplace image the host boots. The bootstrap installs Docker through get.docker.com, which supports Debian, Ubuntu, RHEL, and Fedora."
  type = object({
    publisher = string
    offer     = string
    sku       = string
    version   = string
  })
  default = {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

variable "sourceImageId" {
  description = "Resource ID of a specific image or shared image gallery version. Takes precedence over osImage; use it to pin a hardened or golden base image."
  type        = string
  default     = ""
}

variable "acceleratedNetworking" {
  description = "Enable accelerated networking. Supported on most sizes from two vCPUs upward."
  type        = bool
  default     = true
}

variable "encryptionAtHost" {
  description = "Encrypt disk and temp data at the host. Requires the subscription-level feature to be registered first."
  type        = bool
  default     = false
}
