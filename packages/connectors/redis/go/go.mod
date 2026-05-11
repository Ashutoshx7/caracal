// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Go module definition for the Redis revocation connector.

module github.com/garudex-labs/caracal/revocationredis

go 1.26

require (
	github.com/garudex-labs/caracal/core v0.0.0
	github.com/garudex-labs/caracal/revocation v0.0.0
	github.com/redis/go-redis/v9 v9.19.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	go.uber.org/atomic v1.11.0 // indirect
)

replace github.com/garudex-labs/caracal/core => ../../../core/go

replace github.com/garudex-labs/caracal/revocation => ../../../revocation/go
