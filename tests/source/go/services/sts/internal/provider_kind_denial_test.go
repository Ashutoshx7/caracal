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

// Unknown provider kinds must fail closed: applyProviderDirective must return an error and must not
// weaken upstream authentication or mint a provider token. This guards the contract that only
// explicitly supported kinds are authorized at the token boundary.
func TestBuildUpstreamDirectiveFailsClosedOnUnknownProviderKind(t *testing.T) {
	upstreamURL := "https://api.pipernet.example"
	zek := []byte("12345678901234567890123456789012")
	cases := []struct {
		name string
		kind *string
	}{
		{"unsupported model endpoint kind", strPtr("llm_openai")},
		{"unset kind", nil},
		{"wrong case", strPtr("API_KEY")},
		{"trailing space", strPtr("api_key ")},
		{"partial oauth", strPtr("oauth2")},
		{"partial bearer", strPtr("bearer")},
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
				provider: &ProviderConfig{ID: providerID, ProviderKind: tc.kind, ConfigJSON: []byte(`{}`)},
			}, zek)
			directive, err := srv.buildUpstreamDirective(context.Background(), "zone1", map[string]any{"sub": "user1"}, resource, true, false)
			if err == nil || !strings.Contains(err.Error(), "provider kind unsupported") {
				t.Fatalf("an unknown provider kind must deny with an unsupported-kind error, got directive=%#v err=%v", directive, err)
			}
			if directive.AuthMode != UpstreamAuthCaracalJWT {
				t.Fatalf("a denied kind must preserve upstream auth: %#v", directive)
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
