# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Google Cloud adapter for the Caracal host contract: one instance, its network exposure, its identity, and its DNS names.

# Experimental. Schema-validated, not yet exercised against a live Google Cloud project.

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.50"
    }
  }
}

locals {
  # Cloud DNS record names are absolute and end with a dot.
  records = { for host in var.hostnames : host => "${trimsuffix(host, ".")}." }
}

resource "google_compute_network" "caracal" {
  name                    = "${var.name}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "caracal" {
  name          = "${var.name}-subnet"
  region        = var.region
  network       = google_compute_network.caracal.id
  ip_cidr_range = cidrsubnet(var.networkCidr, 8, 0)
}

# 80 stays open alongside 443 because the host's certificate issuance answers
# the ACME challenge over plain HTTP before any certificate exists.
resource "google_compute_firewall" "ingress" {
  name          = "${var.name}-ingress"
  network       = google_compute_network.caracal.name
  direction     = "INGRESS"
  source_ranges = var.ingressCidrs
  target_tags   = [var.name]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_firewall" "admin" {
  count = length(var.adminCidrs) > 0 ? 1 : 0

  name          = "${var.name}-admin"
  network       = google_compute_network.caracal.name
  direction     = "INGRESS"
  source_ranges = var.adminCidrs
  target_tags   = [var.name]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_service_account" "caracal" {
  account_id   = "${var.name}-host"
  display_name = "Caracal host ${var.name}"
}

resource "google_compute_address" "caracal" {
  name   = "${var.name}-address"
  region = var.region
}

resource "google_compute_instance" "caracal" {
  name         = var.name
  machine_type = var.machineSize
  zone         = var.zone
  tags         = [var.name]
  labels       = var.tags

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = var.diskGb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.caracal.id

    access_config {
      nat_ip = google_compute_address.caracal.address
    }
  }

  metadata = {
    user-data = var.userData
    ssh-keys  = "${var.adminUsername}:${var.adminPublicKey}"
  }

  service_account {
    email  = google_service_account.caracal.email
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }
}

resource "google_dns_record_set" "caracal" {
  for_each = var.dnsZone == "" ? {} : local.records

  managed_zone = var.dnsZone
  name         = each.value
  type         = "A"
  ttl          = var.dnsTtl
  rrdatas      = [google_compute_address.caracal.address]
}
