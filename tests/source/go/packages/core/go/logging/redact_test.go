// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for centralized secret-key redaction.

package logging

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestIsSecretKey(t *testing.T) {
	cases := map[string]bool{
		"password":      true,
		"user_password": true,
		"X-Auth-Token":  true,
		"Authorization": true,
		"refresh_token": true,
		"hmac_key":      true,
		"set-cookie":    true,
		"signature":     true,
		"zone_id":       false,
		"request_id":    false,
		"username":      false,
	}
	for k, want := range cases {
		if got := IsSecretKey(k); got != want {
			t.Errorf("IsSecretKey(%q) = %v, want %v", k, got, want)
		}
	}
}

func TestRedactMap(t *testing.T) {
	in := map[string]any{
		"zone_id":  "z1",
		"password": "hunter2",
		"nested": map[string]any{
			"api_key": "k",
			"keep":    1,
		},
	}
	out := RedactMap(in)
	if out["zone_id"] != "z1" {
		t.Fatalf("zone_id mutated: %v", out["zone_id"])
	}
	if out["password"] != RedactValue {
		t.Fatalf("password not redacted: %v", out["password"])
	}
	nested, _ := out["nested"].(map[string]any)
	if nested["api_key"] != RedactValue {
		t.Fatalf("nested api_key not redacted: %v", nested["api_key"])
	}
	if nested["keep"] != 1 {
		t.Fatalf("nested keep mutated: %v", nested["keep"])
	}
	if in["password"] == RedactValue {
		t.Fatal("input mutated")
	}
}

func TestRedactMapNilReturnsNil(t *testing.T) {
	if RedactMap(nil) != nil {
		t.Fatal("nil map must redact to nil")
	}
}

func TestRedactValueSliceAndScalar(t *testing.T) {
	in := map[string]any{
		"list":   []any{"Bearer abcdefghijklmnopqrstuvwxyz", "plain", 5},
		"number": 42,
		"flag":   true,
	}
	out := RedactMap(in)
	list, ok := out["list"].([]any)
	if !ok || len(list) != 3 {
		t.Fatalf("list not preserved: %v", out["list"])
	}
	if s, _ := list[0].(string); !strings.Contains(s, RedactValue) {
		t.Fatalf("bearer token in slice not redacted: %v", list[0])
	}
	if list[1] != "plain" || list[2] != 5 {
		t.Fatalf("non-secret slice entries mutated: %v", list)
	}
	if out["number"] != 42 || out["flag"] != true {
		t.Fatalf("scalar values must pass through unchanged: %v", out)
	}
}

func TestRedactStringScrubsQueryCredentials(t *testing.T) {
	cases := []struct {
		name string
		in   string
		gone string
	}{
		{"api key", `Post "https://api.example/v1/run?api_key=sk-live-abc123def456": dial tcp: refused`, "sk-live-abc123def456"},
		{"camel case param", `https://api.example/v1?apiKey=sk-live-abc123def456&model=x`, "sk-live-abc123def456"},
		{"access token", `https://api.example/v1?access_token=abc123def456ghi&z=1`, "abc123def456ghi"},
		{"client secret", `https://idp.example/token?client_secret=shhhh-very-secret&a=b`, "shhhh-very-secret"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := RedactString(tc.in)
			if strings.Contains(got, tc.gone) {
				t.Fatalf("RedactString kept the credential: %q", got)
			}
			if !strings.Contains(got, RedactValue) {
				t.Fatalf("RedactString did not mark a redaction: %q", got)
			}
		})
	}
}

func TestRedactStringKeepsNonSecretQueryParams(t *testing.T) {
	in := `https://api.example/v1/chat?model=gpt-5.5&stream=true&limit=100`
	if got := RedactString(in); got != in {
		t.Fatalf("RedactString altered a credential-free url: %q", got)
	}
}

// A record is scrubbed at the one point every service logger writes through, so a call site
// that hands a raw transport error to the logger cannot leak a query-placed credential.
func TestRedactRecordScrubsSerializedRecord(t *testing.T) {
	line := []byte(`{"level":"error","msg":"upstream request failed","err":"Post \"https://api.example/v1?api_key=sk-live-abc123def456\": refused"}`)
	got := string(redactRecord(line))
	if strings.Contains(got, "sk-live-abc123def456") {
		t.Fatalf("record kept the credential: %q", got)
	}
	if !strings.Contains(got, RedactValue) {
		t.Fatalf("record was not redacted: %q", got)
	}
	var parsed map[string]any
	if err := json.Unmarshal(redactRecord(line), &parsed); err != nil {
		t.Fatalf("redacted record is no longer valid json: %v", err)
	}
}

func TestRedactRecordReturnsInputWhenNothingMatches(t *testing.T) {
	line := []byte(`{"level":"info","msg":"started","port":8080}`)
	if got := redactRecord(line); &got[0] != &line[0] {
		t.Fatal("redactRecord copied a record that needed no change")
	}
}
