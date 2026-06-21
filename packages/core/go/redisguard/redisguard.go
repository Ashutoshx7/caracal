// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Startup guard that warns when a connected Redis may silently evict Caracal's correctness-critical keys.

package redisguard

import (
	"context"
	"strings"

	"github.com/rs/zerolog"
)

const (
	// EvictionPolicyParam is the Redis CONFIG parameter that governs key eviction.
	EvictionPolicyParam = "maxmemory-policy"
	// SafeEvictionPolicy is the only policy under which revocation entries and
	// stream messages are guaranteed never to be silently dropped.
	SafeEvictionPolicy = "noeviction"
)

// WarnIfUnsafeEviction reads the Redis eviction policy through get and logs a
// warning when it is not noeviction. Caracal stores revocation entries and
// stream messages in Redis, so any other policy can silently drop them under
// memory pressure and weaken revocation correctness. A getter error means the
// policy cannot be introspected (some managed Redis restrict CONFIG GET); that
// case is skipped so the check never blocks startup or readiness.
func WarnIfUnsafeEviction(ctx context.Context, get func(context.Context) (string, error), log zerolog.Logger) {
	policy, err := get(ctx)
	if err != nil {
		log.Debug().Err(err).Msg("redis eviction policy not introspectable; skipping eviction safety check")
		return
	}
	policy = strings.ToLower(strings.TrimSpace(policy))
	if policy == "" || policy == SafeEvictionPolicy {
		return
	}
	log.Warn().
		Str(EvictionPolicyParam, policy).
		Str("required", SafeEvictionPolicy).
		Msg("redis eviction policy may silently drop revocation and stream entries; set 'maxmemory-policy noeviction' on the Caracal revocation store")
}
