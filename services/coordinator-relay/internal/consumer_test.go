// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator relay configuration tests.

package internal

import (
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"

	sharedcrypto "github.com/garudex-labs/caracal/packages/core/go/crypto"
)

func TestLoadConfigDoesNotRequirePortOrDatabase(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig should not require unrelated service env vars: %v", err)
	}
	if cfg.RedisURL == "" {
		t.Fatal("Redis URL must be loaded")
	}
}

func TestLoadConfigResolvesStreamHMACKeyFile(t *testing.T) {
	key := make([]byte, 32)
	encoded := hex.EncodeToString(key)
	path := filepath.Join(t.TempDir(), "stream-key")
	if err := os.WriteFile(path, []byte(encoded+"\n"), 0o600); err != nil {
		t.Fatalf("write key file: %v", err)
	}

	t.Setenv("CARACAL_MODE", "stable")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", path)

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig should resolve STREAMS_HMAC_KEY_FILE: %v", err)
	}
	if !cfg.RequireSig || len(cfg.StreamHMACKey) != 32 {
		t.Fatalf("stable relay must require and load a 32-byte stream key, got require=%v len=%d", cfg.RequireSig, len(cfg.StreamHMACKey))
	}
}

func TestPositiveSecondsRejectsInvalidValues(t *testing.T) {
	t.Setenv("RELAY_CLAIM_IDLE_SEC", "0")
	if _, err := positiveSeconds("RELAY_CLAIM_IDLE_SEC", int(time.Minute/time.Second)); err == nil {
		t.Fatal("zero seconds must fail")
	}
}

func TestPositiveSecondsFallbackAndValid(t *testing.T) {
	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "")
	got, err := positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 42)
	if err != nil {
		t.Fatalf("unset value should fall back without error: %v", err)
	}
	if got != 42 {
		t.Fatalf("expected fallback 42, got %d", got)
	}

	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "120")
	got, err = positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 42)
	if err != nil {
		t.Fatalf("valid value should parse: %v", err)
	}
	if got != 120 {
		t.Fatalf("expected parsed 120, got %d", got)
	}
}

func TestPositiveSecondsRejectsNonNumeric(t *testing.T) {
	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "abc")
	if _, err := positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 1); err == nil {
		t.Fatal("non-numeric value must fail")
	}
}

func TestLoadConfigRequiresHMACKeyInStable(t *testing.T) {
	t.Setenv("CARACAL_MODE", "stable")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	if _, err := loadConfig(); err == nil {
		t.Fatal("stable mode must require a stream HMAC key")
	}
}

func TestLoadConfigRejectsInvalidHMACKey(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "not-hex")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	if _, err := loadConfig(); err == nil {
		t.Fatal("a non-hex stream HMAC key must be rejected")
	}
}

func TestStringVal(t *testing.T) {
	if got := stringVal("value"); got != "value" {
		t.Fatalf("expected string passthrough, got %q", got)
	}
	if got := stringVal(42); got != "" {
		t.Fatalf("non-string must coerce to empty string, got %q", got)
	}
	if got := stringVal(nil); got != "" {
		t.Fatalf("nil must coerce to empty string, got %q", got)
	}
}

func TestVerifyDevModeWithoutKeyAllowsAll(t *testing.T) {
	c := &Consumer{requireSig: false}
	if !c.verify(map[string]any{"event": "spawn"}) {
		t.Fatal("dev mode without a key must accept every message")
	}
}

func TestVerifyWithKeyAcceptsValidAndRejectsTampered(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	c := &Consumer{requireSig: true, streamHMACKey: key}

	values := map[string]any{"event": "spawn", "zone_id": "z1"}
	values[sharedcrypto.StreamSigField] = sharedcrypto.SignStream(key, lifecycleStream, values)
	if !c.verify(values) {
		t.Fatal("a correctly signed lifecycle event must verify")
	}

	values["zone_id"] = "tampered"
	if c.verify(values) {
		t.Fatal("a tampered lifecycle event must not verify")
	}
}
