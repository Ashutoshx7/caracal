// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for the per-subject token-bucket rate limiter.

package internal

import (
	"testing"
	"time"
)

func TestRateLimiterRejectsEmptySubject(t *testing.T) {
	r := NewRateLimiter(10, time.Second)
	if r.Allow("") {
		t.Fatal("empty subject must be rejected")
	}
}

func TestRateLimiterAllowsUpToCapacityPerSubject(t *testing.T) {
	r := NewRateLimiter(3, time.Minute)
	for i := 0; i < 3; i++ {
		if !r.Allow("alice") {
			t.Fatalf("call %d should be allowed", i)
		}
	}
	if r.Allow("alice") {
		t.Fatal("4th call must be limited")
	}
	if !r.Allow("bob") {
		t.Fatal("different subject must have its own bucket")
	}
}
