// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Go module definition for the transport-mcp framework-neutral auth core.

module github.com/garudex-labs/caracal/packages/transport/mcp/go

go 1.26

require (
	github.com/garudex-labs/caracal/packages/identity/go v0.0.0-00010101000000-000000000000
	github.com/garudex-labs/caracal/packages/revocation/go v0.0.0-00010101000000-000000000000
)

require (
	github.com/garudex-labs/caracal/packages/core/go v0.0.0-00010101000000-000000000000 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
)

replace (
	github.com/garudex-labs/caracal/packages/core/go => ../../../core/go
	github.com/garudex-labs/caracal/packages/identity/go => ../../../identity/go
	github.com/garudex-labs/caracal/packages/revocation/go => ../../../revocation/go
)
