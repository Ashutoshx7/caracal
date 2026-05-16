// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JWKS EC public-key parser used by the control authenticator to materialize ES256 verification keys.

package internal

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
)

type jwk struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	Kid string `json:"kid"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

func parseECPublicKey(raw json.RawMessage) (*ecdsa.PublicKey, string, error) {
	var k jwk
	if err := json.Unmarshal(raw, &k); err != nil {
		return nil, "", err
	}
	if k.Kty != "EC" || k.Crv != "P-256" {
		return nil, "", errors.New("unsupported key type")
	}
	x, err := base64.RawURLEncoding.DecodeString(k.X)
	if err != nil {
		return nil, "", err
	}
	y, err := base64.RawURLEncoding.DecodeString(k.Y)
	if err != nil {
		return nil, "", err
	}
	return &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}, k.Kid, nil
}
