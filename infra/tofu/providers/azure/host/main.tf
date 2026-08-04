# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Azure adapter for the Caracal host contract: one VM, its network exposure, its identity, and its DNS names.

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.81"
    }
  }
}

locals {
  # DNS records are created relative to the zone, so the zone suffix is trimmed
  # from each fully qualified name the caller supplied.
  records   = { for host in var.hostnames : host => trimsuffix(trimsuffix(host, var.dnsZone), ".") }
  dnsZoneRg = var.dnsZoneResourceGroupName != "" ? var.dnsZoneResourceGroupName : var.resourceGroupName
}

resource "azurerm_virtual_network" "caracal" {
  name                = "${var.name}-network"
  resource_group_name = var.resourceGroupName
  location            = var.region
  address_space       = [var.networkCidr]
  tags                = var.tags
}

resource "azurerm_subnet" "caracal" {
  name                 = "${var.name}-subnet"
  resource_group_name  = var.resourceGroupName
  virtual_network_name = azurerm_virtual_network.caracal.name
  address_prefixes     = [cidrsubnet(var.networkCidr, 8, 0)]
}

resource "azurerm_network_security_group" "caracal" {
  name                = "${var.name}-security"
  resource_group_name = var.resourceGroupName
  location            = var.region
  tags                = var.tags

  # 80 stays open alongside 443 because the host's certificate issuance answers
  # the ACME challenge over plain HTTP before any certificate exists.
  security_rule {
    name                       = "https"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443"]
    source_address_prefixes    = var.ingressCidrs
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "admin"
    priority                   = 200
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefixes    = var.adminCidrs
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "caracal" {
  subnet_id                 = azurerm_subnet.caracal.id
  network_security_group_id = azurerm_network_security_group.caracal.id
}

resource "azurerm_public_ip" "caracal" {
  name                = "${var.name}-address"
  resource_group_name = var.resourceGroupName
  location            = var.region
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_network_interface" "caracal" {
  name                = "${var.name}-interface"
  resource_group_name = var.resourceGroupName
  location            = var.region
  tags                = var.tags

  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.caracal.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.caracal.id
  }
}

resource "azurerm_user_assigned_identity" "caracal" {
  name                = "${var.name}-identity"
  resource_group_name = var.resourceGroupName
  location            = var.region
  tags                = var.tags
}

resource "azurerm_linux_virtual_machine" "caracal" {
  name                            = var.name
  resource_group_name             = var.resourceGroupName
  location                        = var.region
  size                            = var.machineSize
  admin_username                  = var.adminUsername
  network_interface_ids           = [azurerm_network_interface.caracal.id]
  disable_password_authentication = true
  custom_data                     = base64encode(var.userData)
  tags                            = var.tags

  admin_ssh_key {
    username   = var.adminUsername
    public_key = var.adminPublicKey
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.caracal.id]
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = var.diskGb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

resource "azurerm_dns_a_record" "caracal" {
  for_each = var.dnsZone == "" ? {} : local.records

  name                = each.value == "" ? "@" : each.value
  zone_name           = var.dnsZone
  resource_group_name = local.dnsZoneRg
  ttl                 = var.dnsTtl
  records             = [azurerm_public_ip.caracal.ip_address]
  tags                = var.tags
}
