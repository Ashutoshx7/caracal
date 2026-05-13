// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Issued-JTI registry: SETNX-backed audit trail of every minted access token.

package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const jtiRegistryPrefix = "audit:jti:"

// recordIssuedJTI writes a SETNX entry keyed by the new token's JTI with TTL equal
// to the token lifetime. A SETNX collision indicates either a duplicate UUIDv7
// (cryptographically improbable) or a clock anomaly. Either case is treated as a
// hard failure: the audit event is emitted and the caller must reject the
// exchange so the duplicate token never reaches a relying party.
func (s *Server) recordIssuedJTI(ctx context.Context, jti, appID, zoneID, requestID string, ttl time.Duration) error {
	if s.redis == nil || jti == "" {
		return nil
	}
	value := fmt.Sprintf("%s|%d", appID, time.Now().Unix())
	created, err := s.redis.SetNXTTL(ctx, jtiRegistryPrefix+jti, value, ttl)
	if err != nil {
		s.log.Error().Err(err).Str("jti", jti).Msg("jti registry write failed")
		return err
	}
	if !created {
		id, err := uuid.NewV7()
		if err != nil {
			s.log.Error().Err(err).Str("jti", jti).Msg("jti collision audit id generation failed")
			return err
		}
		meta, _ := json.Marshal(map[string]any{
			"jti":        jti,
			"app_id":     appID,
			"request_id": requestID,
		})
		s.auditBuffer.Emit(AuditEvent{
			ID:               id.String(),
			ZoneID:           zoneID,
			EventType:        "jti_collision",
			RequestID:        requestID,
			Decision:         "deny",
			EvaluationStatus: "anomaly",
			MetadataJSON:     meta,
			OccurredAt:       time.Now(),
		})
		s.log.Error().Str("jti", jti).Str("app_id", appID).Msg("jti registry collision; rejecting exchange")
		return fmt.Errorf("jti collision: %s", jti)
	}
	return nil
}
