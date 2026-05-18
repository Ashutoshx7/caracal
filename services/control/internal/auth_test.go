// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service bearer-token authentication tests.

package internal

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestNewAuthenticatorDoesNotFetchJWKSAtStartup(t *testing.T) {
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		http.Error(w, "unexpected", http.StatusBadRequest)
	}))
	defer srv.Close()

	t.Setenv("STS_JWKS_URL", srv.URL+"/.well-known/jwks.json")
	t.Setenv("STS_ISSUER_URL", "https://issuer.example")
	t.Setenv("CONTROL_AUDIENCE", "caracal-control")

	if _, err := NewAuthenticator(context.Background()); err != nil {
		t.Fatalf("authenticator should start before a zone JWKS exists: %v", err)
	}
	if requests.Load() != 0 {
		t.Fatalf("authenticator fetched JWKS at startup")
	}
}

func TestVerifyFetchesZoneScopedJWKS(t *testing.T) {
	const zoneID = "zone-test"
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if got := r.URL.Query().Get("zone_id"); got != zoneID {
			t.Fatalf("JWKS request zone_id = %q, want %q", got, zoneID)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "EC",
				"crv": "P-256",
				"use": "sig",
				"kid": "kid-1",
				"alg": "ES256",
				"x":   b64URLUint(key.PublicKey.X),
				"y":   b64URLUint(key.PublicKey.Y),
			}},
		}); err != nil {
			t.Fatal(err)
		}
	}))
	defer srv.Close()

	t.Setenv("STS_JWKS_URL", srv.URL+"/.well-known/jwks.json")
	t.Setenv("STS_ISSUER_URL", "https://issuer.example")
	t.Setenv("CONTROL_AUDIENCE", "caracal-control")

	auth, err := NewAuthenticator(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	token, err := signedControlToken(key, zoneID)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := auth.Verify(context.Background(), "Bearer "+token)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if claims.ZoneID != zoneID {
		t.Fatalf("zone_id = %q, want %q", claims.ZoneID, zoneID)
	}
	if requests.Load() != 1 {
		t.Fatalf("JWKS requests = %d, want 1", requests.Load())
	}
}

func signedControlToken(key *ecdsa.PrivateKey, zoneID string) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "https://issuer.example",
			Subject:   "subject-1",
			Audience:  jwt.ClaimStrings{"caracal-control"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        "jti-1",
		},
		Scope:    "control:invoke",
		ZoneID:   zoneID,
		ClientID: "client-1",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = "kid-1"
	return token.SignedString(key)
}

func b64URLUint(n *big.Int) string {
	v := n.Bytes()
	if len(v) < 32 {
		padded := make([]byte, 32)
		copy(padded[32-len(v):], v)
		v = padded
	}
	return base64.RawURLEncoding.EncodeToString(v)
}
