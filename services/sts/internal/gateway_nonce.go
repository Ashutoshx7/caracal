// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Replay-nonce tracking for HMAC-authenticated internal exchanges.

package internal

import (
	"context"
	"errors"
)

const gatewayNonceKeyPrefix = "caracal:sts:gw-nonce:"

var gatewayNonceTTL = 2 * gatewayExchangeSkew

// consumeGatewayNonce records the request id as consumed and returns an error if
// the same request id was already seen within the replay window. When Redis is
// unavailable the verifier fails closed so a captured signature cannot be
// replayed during an outage.
func (s *Server) consumeGatewayNonce(ctx context.Context, requestID string) error {
	if requestID == "" {
		return errors.New("gateway request id required")
	}
	if s.redis == nil {
		return errors.New("gateway nonce store unavailable")
	}
	ok, err := s.redis.SetNXTTL(ctx, gatewayNonceKeyPrefix+requestID, "1", gatewayNonceTTL)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("gateway request id replay")
	}
	return nil
}
