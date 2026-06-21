// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for the Redis eviction-policy startup guard.

package redisguard

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/rs/zerolog"
)

func capture(t *testing.T, get func(context.Context) (string, error)) string {
	t.Helper()
	var buf bytes.Buffer
	log := zerolog.New(&buf)
	WarnIfUnsafeEviction(context.Background(), get, log)
	return buf.String()
}

func TestWarnsOnUnsafePolicy(t *testing.T) {
	out := capture(t, func(context.Context) (string, error) { return "allkeys-lru", nil })
	if !strings.Contains(out, "\"level\":\"warn\"") || !strings.Contains(out, "allkeys-lru") {
		t.Fatalf("expected warning for allkeys-lru, got: %s", out)
	}
}

func TestSilentOnNoeviction(t *testing.T) {
	out := capture(t, func(context.Context) (string, error) { return "noeviction", nil })
	if strings.Contains(out, "\"level\":\"warn\"") {
		t.Fatalf("expected no warning for noeviction, got: %s", out)
	}
}

func TestNormalizesCasingAndWhitespace(t *testing.T) {
	out := capture(t, func(context.Context) (string, error) { return "  NoEviction  ", nil })
	if strings.Contains(out, "\"level\":\"warn\"") {
		t.Fatalf("expected no warning for normalized noeviction, got: %s", out)
	}
}

func TestSkipsWhenUnreadable(t *testing.T) {
	out := capture(t, func(context.Context) (string, error) { return "", errors.New("CONFIG GET denied") })
	if strings.Contains(out, "\"level\":\"warn\"") {
		t.Fatalf("expected no warning when policy is unreadable, got: %s", out)
	}
}

func TestSilentOnEmptyPolicy(t *testing.T) {
	out := capture(t, func(context.Context) (string, error) { return "", nil })
	if strings.Contains(out, "\"level\":\"warn\"") {
		t.Fatalf("expected no warning for empty policy, got: %s", out)
	}
}
