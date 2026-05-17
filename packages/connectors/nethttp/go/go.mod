// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Go module definition for the net/http MCP middleware adapter.

module github.com/garudex-labs/caracal/packages/connectors/nethttp/go

go 1.26

require (
	github.com/garudex-labs/caracal/packages/identity/go v0.0.0-00010101000000-000000000000
	github.com/garudex-labs/caracal/packages/transport/mcp/go v0.0.0-00010101000000-000000000000
	github.com/golang-jwt/jwt/v5 v5.3.1
)

require (
	github.com/garudex-labs/caracal/packages/core/go v0.0.0-00010101000000-000000000000 // indirect
	github.com/garudex-labs/caracal/packages/revocation/go v0.0.0-00010101000000-000000000000 // indirect
)

replace (
	github.com/garudex-labs/caracal/packages/core/go => ../../../core/go
	github.com/garudex-labs/caracal/packages/identity/go => ../../../identity/go
	github.com/garudex-labs/caracal/packages/revocation/go => ../../../revocation/go
	github.com/garudex-labs/caracal/packages/transport/mcp/go => ../../../transport/mcp/go
)
