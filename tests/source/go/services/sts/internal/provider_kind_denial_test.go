// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests that the STS fails closed on unknown or unsupported provider kinds.

package internal

import (
	"context"
	"strings"
	"testing"
)

// An unknown provider_kind must never resolve to an upstream directive. Every supported kind is
// named explicitly in applyProviderDirective; anything else - a mis-migrated row, a kind the
// provider-surface consolidation chose not to add, a wrong case, or a near-miss spelling - must
// fall through to the fail-closed default so it can neither strip upstream auth nor mint a
// credential. The provider surface reuses api_key rather than adding an llm_openai kind, so this is
// the parity guard that keeps that decision enforced at the token boundary.
func TestBuildUpstreamDirectiveFailsClosedOnUnknownProviderKind(t *testing.T) {
	upstreamURL := "https://api.pipernet.example"
	zek := []byte("12345678901234567890123456789012")
	cases := []struct {
		name string
		kind string
	}{
		{"kind the consolidation did not add", "llm_openai"},
		{"unset kind", ""},
		{"wrong case", "API_KEY"},
		{"trailing space", "api_key "},
		{"partial oauth", "oauth2"},
		{"partial bearer", "bearer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			providerID := "provider1"
			resource := &Resource{
				ID:                   "res1",
				Identifier:           "resource://pipernet",
				UpstreamURL:          &upstreamURL,
				CredentialProviderID: &providerID,
			}
			srv := providerServer(&stubDB{
				provider: &ProviderConfig{ID: providerID, ProviderKind: strPtr(tc.kind), ConfigJSON: []byte(`{}`)},
			}, zek)
			directive, err := srv.buildUpstreamDirective(context.Background(), "zone1", map[string]any{"sub": "user1"}, resource, true, false)
			if err == nil || !strings.Contains(err.Error(), "provider kind unsupported") {
				t.Fatalf("an unknown provider kind must deny with an unsupported-kind error, got directive=%#v err=%v", directive, err)
			}
			if directive.AuthMode == UpstreamAuthNone {
				t.Fatalf("a denied kind must never downgrade upstream auth to none: %#v", directive)
			}
			if directive.ProviderToken != "" {
				t.Fatalf("a denied kind must never mint or attach a provider token: %#v", directive)
			}
		})
	}
}

// applyProviderDirective is the single point that maps a provider kind onto the upstream auth
// directive. Its default branch is the fail-closed guarantee: an unrecognized kind returns an error
// and leaves the directive's auth mode untouched rather than shaping it into an authorized request.
func TestApplyProviderDirectiveDeniesUnknownProviderKind(t *testing.T) {
	provider := &ProviderConfig{ID: "provider1", ProviderKind: strPtr("llm_openai"), ConfigJSON: []byte(`{}`)}
	cfg, err := providerDirectiveConfig(provider.ConfigJSON)
	if err != nil {
		t.Fatalf("provider config: %v", err)
	}
	directive := UpstreamDirective{AuthMode: UpstreamAuthCaracalJWT, AuthHeader: "Authorization", AuthScheme: "Bearer"}
	if err := applyProviderDirective(provider, &directive, cfg); err == nil || !strings.Contains(err.Error(), "provider kind unsupported") {
		t.Fatalf("an unknown provider kind must be denied, got %v", err)
	}
	if directive.AuthMode != UpstreamAuthCaracalJWT {
		t.Fatalf("a denied kind must not rewrite the auth mode: %#v", directive)
	}
}
