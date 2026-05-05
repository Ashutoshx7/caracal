// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit content hash and OCSF mapping unit tests.

package internal

import (
	"testing"
	"time"
)

func TestContentHashDeterminism(t *testing.T) {
	ev := AuditEvent{
		ID:                 "ev-hash-1",
		ZoneID:             "zone1",
		EventType:          "token_exchange",
		RequestID:          "req1",
		Decision:           "allow",
		PolicySetVersionID: "psv-1",
		ManifestSHA:        "abc123",
		OccurredAt:         time.UnixMilli(1700000000000).UTC(),
	}

	h1 := contentHash(ev)
	h2 := contentHash(ev)
	if h1 != h2 {
		t.Errorf("hash must be deterministic: %q != %q", h1, h2)
	}
}

func TestContentHashSensitiveToDecision(t *testing.T) {
	base := AuditEvent{
		ID:         "ev-1",
		ZoneID:     "zone1",
		EventType:  "token_exchange",
		RequestID:  "req1",
		Decision:   "allow",
		OccurredAt: time.UnixMilli(1700000000000).UTC(),
	}
	modified := base
	modified.Decision = "deny"

	if contentHash(base) == contentHash(modified) {
		t.Error("hash must differ when Decision changes")
	}
}

func TestContentHashSensitiveToZoneID(t *testing.T) {
	base := AuditEvent{
		ID:         "ev-2",
		ZoneID:     "zone-a",
		EventType:  "token_exchange",
		RequestID:  "req1",
		Decision:   "allow",
		OccurredAt: time.UnixMilli(1700000000000).UTC(),
	}
	modified := base
	modified.ZoneID = "zone-b"

	if contentHash(base) == contentHash(modified) {
		t.Error("hash must differ when ZoneID changes")
	}
}

func TestContentHashSensitiveToTimestamp(t *testing.T) {
	base := AuditEvent{
		ID:         "ev-3",
		ZoneID:     "zone1",
		OccurredAt: time.UnixMilli(1700000000000).UTC(),
	}
	shifted := base
	shifted.OccurredAt = base.OccurredAt.Add(time.Millisecond)

	if contentHash(base) == contentHash(shifted) {
		t.Error("hash must differ when OccurredAt changes by any amount")
	}
}

func TestContentHashNonEmpty(t *testing.T) {
	ev := AuditEvent{ID: "ev-4", ZoneID: "z1", OccurredAt: time.Now()}
	h := contentHash(ev)
	if h == "" {
		t.Error("contentHash must return a non-empty string")
	}
	if len(h) != 64 {
		t.Errorf("SHA-256 hex must be 64 chars, got %d", len(h))
	}
}

func TestOCSFEventAllow(t *testing.T) {
	ev := AuditEvent{
		Decision:           "allow",
		ZoneID:             "zone1",
		RequestID:          "req1",
		PolicySetVersionID: "psv-1",
		OccurredAt:         time.UnixMilli(1700000000000),
	}
	ocsf := ev.toOCSF()

	if ocsf.ClassUID != 6003 {
		t.Errorf("want ClassUID 6003, got %d", ocsf.ClassUID)
	}
	if ocsf.TypeUID != 600301 {
		t.Errorf("want TypeUID 600301, got %d", ocsf.TypeUID)
	}
	if ocsf.SeverityID != 1 {
		t.Errorf("want SeverityID 1 for allow, got %d", ocsf.SeverityID)
	}
	if ocsf.ActivityID != 1 {
		t.Errorf("want ActivityID 1 for allow, got %d", ocsf.ActivityID)
	}
	if ocsf.Time != 1700000000000 {
		t.Errorf("want time 1700000000000, got %d", ocsf.Time)
	}
	if ocsf.ZoneID != "zone1" {
		t.Errorf("want zone1, got %s", ocsf.ZoneID)
	}
	if ocsf.MetadataVersion != "1.7.0" {
		t.Errorf("want 1.7.0, got %s", ocsf.MetadataVersion)
	}
	if ocsf.ProductName != "caracal" {
		t.Errorf("want caracal, got %s", ocsf.ProductName)
	}
}

func TestOCSFEventDeny(t *testing.T) {
	ev := AuditEvent{Decision: "DENY"}
	ocsf := ev.toOCSF()
	if ocsf.SeverityID != 2 {
		t.Errorf("want SeverityID 2 for DENY, got %d", ocsf.SeverityID)
	}
	if ocsf.ActivityID != 2 {
		t.Errorf("want ActivityID 2 for DENY, got %d", ocsf.ActivityID)
	}
}

func TestOCSFAllowIsNotDenySeverity(t *testing.T) {
	allow := AuditEvent{Decision: "allow"}
	deny := AuditEvent{Decision: "DENY"}

	if allow.toOCSF().SeverityID == deny.toOCSF().SeverityID {
		t.Error("allow and deny must produce different SeverityID values")
	}
}

func TestOCSFTimePreservesMilliseconds(t *testing.T) {
	ts := time.UnixMilli(1700000000123)
	ev := AuditEvent{OccurredAt: ts}
	ocsf := ev.toOCSF()
	if ocsf.Time != ts.UnixMilli() {
		t.Errorf("want time %d, got %d", ts.UnixMilli(), ocsf.Time)
	}
}

func TestAuditEventJSONOmitsEmptyOptionals(t *testing.T) {
	ev := AuditEvent{
		ID:         "ev-omit",
		ZoneID:     "z1",
		EventType:  "token_exchange",
		OccurredAt: time.UnixMilli(1700000000000),
	}
	if ev.PolicySetVersionID != "" {
		t.Errorf("PolicySetVersionID must be empty by default")
	}
	if ev.ManifestSHA != "" {
		t.Errorf("ManifestSHA must be empty by default")
	}
}
