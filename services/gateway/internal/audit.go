// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Gateway audit helpers for resource execution events.

package internal

import (
	"encoding/json"
	"time"

	"github.com/garudex-labs/caracal/packages/core/go/audit"
	"github.com/google/uuid"
)

const gatewayResourceRequestEvent = "gateway_resource_request"

type auditEmitter interface {
	Emit(audit.Event)
}

type gatewayAuditInput struct {
	RequestID          string
	ZoneID             string
	ApplicationID      string
	Resource           string
	SubjectFingerprint string
	Method             string
	UpstreamHost       string
	AuthMode           string
	GatewayStatus      int
	UpstreamStatus     int
	Latency            time.Duration
	EvaluationStatus   string
	ErrorKind          string
}

func gatewayActionEvent(input gatewayAuditInput) (audit.Event, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return audit.Event{}, err
	}
	meta := map[string]any{
		"application_id":      input.ApplicationID,
		"resource":            input.Resource,
		"subject_fingerprint": input.SubjectFingerprint,
		"method":              input.Method,
		"gateway_status":      input.GatewayStatus,
		"latency_ms":          input.Latency.Milliseconds(),
	}
	if input.UpstreamHost != "" {
		meta["upstream_host"] = input.UpstreamHost
	}
	if input.AuthMode != "" {
		meta["auth_mode"] = input.AuthMode
	}
	if input.UpstreamStatus > 0 {
		meta["upstream_status"] = input.UpstreamStatus
	}
	if input.ErrorKind != "" {
		meta["error_kind"] = input.ErrorKind
	}
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return audit.Event{}, err
	}
	emptyJSON := json.RawMessage("[]")
	return audit.Event{
		ID:                      id.String(),
		ZoneID:                  input.ZoneID,
		EventType:               gatewayResourceRequestEvent,
		RequestID:               input.RequestID,
		Decision:                "allow",
		EvaluationStatus:        input.EvaluationStatus,
		DeterminingPoliciesJSON: emptyJSON,
		DiagnosticsJSON:         emptyJSON,
		MetadataJSON:            metaJSON,
		OccurredAt:              time.Now(),
	}, nil
}

func emitGatewayActionAudit(emitter auditEmitter, logEvent func(error), input gatewayAuditInput) {
	if emitter == nil {
		return
	}
	event, err := gatewayActionEvent(input)
	if err != nil {
		logEvent(err)
		return
	}
	emitter.Emit(event)
}
