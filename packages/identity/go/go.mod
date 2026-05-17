// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Go module definition for the identity package.

module github.com/garudex-labs/caracal/packages/identity/go

go 1.26

require (
	github.com/garudex-labs/caracal/packages/core/go v0.0.0-00010101000000-000000000000
	github.com/golang-jwt/jwt/v5 v5.3.1
)

replace github.com/garudex-labs/caracal/packages/core/go => ../../core/go
