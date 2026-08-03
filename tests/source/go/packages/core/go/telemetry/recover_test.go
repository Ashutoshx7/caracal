// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests that a panicking HTTP handler is contained and reported rather than severing the request.

package telemetry

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoverPanicsReturnsInternalError(t *testing.T) {
	handler := recoverPanics("caracal.test.http", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("policy evaluation exploded")
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/authorize", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected a JSON error envelope, got content-type %q", got)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "internal_error") {
		t.Fatalf("expected an error code in the body, got %q", body)
	}
	// The panic value and stack belong in the service log, never in a client response.
	if strings.Contains(body, "policy evaluation exploded") {
		t.Fatal("panic detail must not be returned to the caller")
	}
}

func TestRecoverPanicsPassesThroughSuccess(t *testing.T) {
	handler := recoverPanics("caracal.test.http", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("ok"))
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusAccepted || rec.Body.String() != "ok" {
		t.Fatalf("unmodified responses must pass through, got %d %q", rec.Code, rec.Body.String())
	}
}

// ErrAbortHandler is the documented way to abandon a response, so it must keep propagating.
func TestRecoverPanicsRespectsErrAbortHandler(t *testing.T) {
	handler := recoverPanics("caracal.test.http", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if cause := recover(); cause != http.ErrAbortHandler {
			t.Fatalf("expected ErrAbortHandler to propagate, got %v", cause)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/stream", nil))
}
