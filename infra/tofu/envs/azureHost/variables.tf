# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Input surface for the Azure VM environment.

variable "subscriptionId" {
  description = "Subscription the host is created in."
  type        = string
}

variable "resourceGroupName" {
  description = "Existing resource group that holds the host. Deleting this group is the complete teardown for a disposable environment."
  type        = string
}

variable "name" {
  description = "Name applied to the host and its supporting resources."
  type        = string
  default     = "caracal"
}

variable "region" {
  description = "Azure region the host runs in."
  type        = string
}

variable "zone" {
  description = "Availability zone for the host and its address. Empty lets the platform choose."
  type        = string
  default     = ""
}

variable "adminUsername" {
  description = "Operating system account created for administrative access."
  type        = string
  default     = "caracaladmin"
}

variable "subnetId" {
  description = "Existing subnet to attach the host to. Empty creates a dedicated network for the host."
  type        = string
  default     = ""
}

variable "networkCidr" {
  description = "Address range for the network created when subnetId is empty."
  type        = string
  default     = "10.60.0.0/16"
}

variable "diskType" {
  description = "Root disk storage class. Premium_LRS suits the bundled database; StandardSSD_LRS is cheaper for evaluation."
  type        = string
  default     = "Premium_LRS"
}

variable "sourceImageId" {
  description = "Resource ID of a specific or hardened base image. Empty uses the published Ubuntu LTS image."
  type        = string
  default     = ""
}

variable "encryptionAtHost" {
  description = "Encrypt disk and temp data at the host. Requires the subscription feature to be registered first."
  type        = bool
  default     = false
}

variable "caracalVersion" {
  description = "Caracal release to install, as a release tag."
  type        = string
}

variable "machineSize" {
  description = "VM size. The packaged stack runs six services plus Postgres and Redis on one host, so four vCPUs is the practical floor."
  type        = string
  default     = "Standard_D4as_v5"
}

variable "diskGb" {
  description = "Root disk size. It holds container images and all database and Redis state."
  type        = number
  default     = 128
}

variable "adminPublicKey" {
  description = "SSH public key authorised for administrative access."
  type        = string
}

variable "tlsProxy" {
  description = "Public hostnames and the Caracal service behind each. The console origin and token issuer are derived from these routes."
  type = object({
    email  = string
    routes = map(string)
  })
}

variable "ingressCidrs" {
  description = "Source ranges permitted to reach HTTP and HTTPS. Certificate issuance needs 80 reachable from the public internet."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "adminCidrs" {
  description = "Source ranges permitted to reach SSH. Empty admits none; set your own address rather than opening it broadly."
  type        = list(string)
  default     = []
}

variable "envOverrides" {
  description = "Non-secret runtime overrides written to the host environment file before first start."
  type        = map(string)
  default     = {}
}

variable "dnsZone" {
  description = "Azure DNS zone owning the hostnames. Leave empty when DNS is managed elsewhere and create the records there."
  type        = string
  default     = ""
}

variable "dnsZoneResourceGroupName" {
  description = "Resource group holding the DNS zone. Defaults to the host's resource group."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to every created resource."
  type        = map(string)
  default     = {}
}
