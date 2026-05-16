// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for the control dispatcher: allowlist enforcement and upstream binding.

package internal

import (
	"context"
	"errors"
	"testing"
)

func TestDispatchRejectsUnknownCommand(t *testing.T) {
	d := NewDispatcher()
	_, err := d.Dispatch(context.Background(), Request{Command: "bogus", Subcommand: "list"})
	if !errors.Is(err, ErrDenied) {
		t.Fatalf("expected ErrDenied, got %v", err)
	}
}

func TestDispatchRejectsUnknownSubcommand(t *testing.T) {
	d := NewDispatcher()
	d.Register("zone", func(_ context.Context, _ string, _ map[string]any) (any, error) { return nil, nil })
	_, err := d.Dispatch(context.Background(), Request{Command: "zone", Subcommand: "wreck"})
	if !errors.Is(err, ErrDenied) {
		t.Fatalf("expected ErrDenied for bad subcommand, got %v", err)
	}
}

func TestDispatchRejectsHiddenCommand(t *testing.T) {
	d := NewDispatcher()
	d.Register("completion", func(_ context.Context, _ string, _ map[string]any) (any, error) { return "ok", nil })
	_, err := d.Dispatch(context.Background(), Request{Command: "completion", Subcommand: "bash"})
	if !errors.Is(err, ErrDenied) {
		t.Fatalf("hidden command must be denied, got %v", err)
	}
}

func TestDispatchAllowsRegisteredCommand(t *testing.T) {
	d := NewDispatcher()
	d.Register("zone", func(_ context.Context, sub string, _ map[string]any) (any, error) {
		if sub != "list" {
			t.Fatalf("unexpected sub %q", sub)
		}
		return map[string]string{"ok": "true"}, nil
	})
	got, err := d.Dispatch(context.Background(), Request{Command: "zone", Subcommand: "list"})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	m, ok := got.(map[string]string)
	if !ok || m["ok"] != "true" {
		t.Fatalf("unexpected result %#v", got)
	}
}

func TestDispatcherReportsUpstreamReadiness(t *testing.T) {
	d := NewDispatcher()
	if d.HasUpstreams() {
		t.Fatal("empty dispatcher must not report upstream readiness")
	}
	d.Register("zone", func(_ context.Context, _ string, _ map[string]any) (any, error) { return nil, nil })
	if !d.HasUpstreams() {
		t.Fatal("registered dispatcher must report upstream readiness")
	}
}

func TestDispatchUnsupportedWhenUpstreamMissing(t *testing.T) {
	d := NewDispatcher()
	_, err := d.Dispatch(context.Background(), Request{Command: "zone", Subcommand: "list"})
	if !errors.Is(err, ErrUnsupported) {
		t.Fatalf("expected ErrUnsupported, got %v", err)
	}
}

func TestDispatchRejectsShellMetacharacters(t *testing.T) {
	d := NewDispatcher()
	for _, name := range []string{"zone; rm -rf /", "zone\nrm", "$(rm)", "../zone"} {
		_, err := d.Dispatch(context.Background(), Request{Command: name, Subcommand: "list"})
		if !errors.Is(err, ErrDenied) {
			t.Fatalf("expected ErrDenied for %q, got %v", name, err)
		}
	}
}
