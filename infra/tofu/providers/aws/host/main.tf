# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# AWS adapter for the Caracal host contract: one instance, its network exposure, its identity, and its DNS names.

# Experimental. Schema-validated, not yet exercised against a live AWS account.

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.57"
    }
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_vpc" "caracal" {
  cidr_block           = var.networkCidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(var.tags, { Name = "${var.name}-network" })
}

resource "aws_internet_gateway" "caracal" {
  vpc_id = aws_vpc.caracal.id
  tags   = merge(var.tags, { Name = "${var.name}-gateway" })
}

resource "aws_subnet" "caracal" {
  vpc_id                  = aws_vpc.caracal.id
  cidr_block              = cidrsubnet(var.networkCidr, 8, 0)
  map_public_ip_on_launch = false
  tags                    = merge(var.tags, { Name = "${var.name}-subnet" })
}

resource "aws_route_table" "caracal" {
  vpc_id = aws_vpc.caracal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.caracal.id
  }

  tags = merge(var.tags, { Name = "${var.name}-routes" })
}

resource "aws_route_table_association" "caracal" {
  subnet_id      = aws_subnet.caracal.id
  route_table_id = aws_route_table.caracal.id
}

resource "aws_security_group" "caracal" {
  name        = "${var.name}-security"
  description = "Caracal host ingress and egress"
  vpc_id      = aws_vpc.caracal.id
  tags        = merge(var.tags, { Name = "${var.name}-security" })

  # 80 stays open alongside 443 because the host's certificate issuance answers
  # the ACME challenge over plain HTTP before any certificate exists.
  ingress {
    description = "https"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.ingressCidrs
  }

  ingress {
    description = "https"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.ingressCidrs
  }

  dynamic "ingress" {
    for_each = length(var.adminCidrs) > 0 ? [1] : []
    content {
      description = "admin"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.adminCidrs
    }
  }

  egress {
    description = "outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "caracal" {
  name = "${var.name}-host"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "caracal" {
  name = "${var.name}-host"
  role = aws_iam_role.caracal.name
  tags = var.tags
}

resource "aws_key_pair" "caracal" {
  key_name   = "${var.name}-admin"
  public_key = var.adminPublicKey
  tags       = var.tags
}

resource "aws_instance" "caracal" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.machineSize
  subnet_id              = aws_subnet.caracal.id
  vpc_security_group_ids = [aws_security_group.caracal.id]
  iam_instance_profile   = aws_iam_instance_profile.caracal.name
  key_name               = aws_key_pair.caracal.key_name
  user_data              = var.userData
  tags                   = merge(var.tags, { Name = var.name })

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.diskGb
    encrypted   = true
  }
}

resource "aws_eip" "caracal" {
  instance = aws_instance.caracal.id
  domain   = "vpc"
  tags     = merge(var.tags, { Name = "${var.name}-address" })
}

resource "aws_route53_record" "caracal" {
  for_each = var.dnsZone == "" ? toset([]) : toset(var.hostnames)

  zone_id = var.dnsZone
  name    = each.value
  type    = "A"
  ttl     = var.dnsTtl
  records = [aws_eip.caracal.public_ip]
}
