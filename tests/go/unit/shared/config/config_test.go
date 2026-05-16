// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared config unit tests for environment-driven defaults and required values.

package config

import (
	"reflect"
	"testing"
	"time"
)

func TestGetenvUsesFallbackForMissingOrEmptyValue(t *testing.T) {
	t.Setenv("CARACAL_TEST_EMPTY", "")
	if got := Getenv("CARACAL_TEST_MISSING", "fallback"); got != "fallback" {
		t.Fatalf("want fallback for missing env, got %q", got)
	}
	if got := Getenv("CARACAL_TEST_EMPTY", "fallback"); got != "fallback" {
		t.Fatalf("want fallback for empty env, got %q", got)
	}
}

func TestMustGetenvPanicsWhenMissing(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatal("expected panic for missing env var")
		}
	}()
	MustGetenv("CARACAL_TEST_REQUIRED")
}

func TestIntEnvUsesFallbackForMissingAndPanicsForInvalidValues(t *testing.T) {
	t.Setenv("CARACAL_TEST_ZERO", "0")
	t.Setenv("CARACAL_TEST_INVALID", "abc")
	t.Setenv("CARACAL_TEST_VALUE", "12")

	if got := IntEnv("CARACAL_TEST_MISSING", 7); got != 7 {
		t.Fatalf("want fallback for missing env, got %d", got)
	}
	assertPanics(t, func() { IntEnv("CARACAL_TEST_ZERO", 7) })
	assertPanics(t, func() { IntEnv("CARACAL_TEST_INVALID", 7) })
	if got := IntEnv("CARACAL_TEST_VALUE", 7); got != 12 {
		t.Fatalf("want parsed env, got %d", got)
	}
}

func assertPanics(t *testing.T, f func()) {
	t.Helper()
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatal("expected panic")
		}
	}()
	f()
}

func TestStrictEnvParsers(t *testing.T) {
	t.Setenv("CARACAL_TEST_DURATION", "3s")
	t.Setenv("CARACAL_TEST_INT64", "42")
	t.Setenv("CARACAL_TEST_BOOL", "true")
	t.Setenv("CARACAL_TEST_CSV", "a, B ,c,, d ")

	if got := DurationEnv("CARACAL_TEST_DURATION", time.Second); got != 3*time.Second {
		t.Fatalf("want parsed duration, got %s", got)
	}
	if got := Int64Env("CARACAL_TEST_INT64", 7); got != 42 {
		t.Fatalf("want parsed int64, got %d", got)
	}
	if got := BoolEnv("CARACAL_TEST_BOOL", false); !got {
		t.Fatalf("want parsed bool")
	}
	if got := CSVEnv("CARACAL_TEST_CSV"); !reflect.DeepEqual(got, []string{"a", "b", "c", "d"}) {
		t.Fatalf("want normalized csv values, got %v", got)
	}
}

func TestLoadReadsBaseConfig(t *testing.T) {
	t.Setenv("PORT", "8080")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("REDIS_URL", "redis://example")
	t.Setenv("LOG_LEVEL", "debug")

	cfg := Load()
	if cfg.Port != "8080" || cfg.DatabaseURL != "postgres://example" || cfg.RedisURL != "redis://example" || cfg.LogLevel != "debug" {
		t.Fatalf("unexpected config: %#v", cfg)
	}
}
