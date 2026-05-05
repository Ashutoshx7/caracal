// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit event types and OCSF v1.7.0 Authorization Activity mapping.

package internal

import (
	"encoding/json"
	"time"
)

// AuditEvent matches the payload emitted by STS to caracal.audit.events.
type AuditEvent struct {
	ID                  string          `json:"id"`
	ZoneID              string          `json:"zone_id"`
	EventType           string          `json:"event_type"`
	RequestID           string          `json:"request_id"`
	Decision            string          `json:"decision"`
	PolicySetID         string          `json:"policy_set_id"`
	PolicySetVersionID  string          `json:"policy_set_version_id"`
	ManifestSHA         string          `json:"manifest_sha"`
	EvaluationStatus    string          `json:"evaluation_status"`
	DeterminingPolicies []string        `json:"determining_policies"`
	Diagnostics         json.RawMessage `json:"diagnostics"`
	Metadata            json.RawMessage `json:"metadata"`
	OccurredAt          time.Time       `json:"occurred_at"`
}

// OCSFEvent is the OCSF v1.7.0 Authorization Activity (class_uid 6003) shape for Parquet.
type OCSFEvent struct {
	ClassUID           int32  `parquet:"class_uid"`
	TypeUID            int32  `parquet:"type_uid"`
	SeverityID         int32  `parquet:"severity_id"`
	ActivityID         int32  `parquet:"activity_id"`
	Time               int64  `parquet:"time"`
	ZoneID             string `parquet:"zone_id"`
	RequestID          string `parquet:"request_id"`
	PolicySetVersionID string `parquet:"policy_set_version_id"`
	Decision           string `parquet:"decision"`
	MetadataVersion    string `parquet:"metadata_version"`
	ProductName        string `parquet:"product_name"`
}

func (e AuditEvent) toOCSF() OCSFEvent {
	severityID := int32(1)
	activityID := int32(1)
	if e.Decision == "DENY" {
		severityID = 2
		activityID = 2
	}
	return OCSFEvent{
		ClassUID:           6003,
		TypeUID:            600301,
		SeverityID:         severityID,
		ActivityID:         activityID,
		Time:               e.OccurredAt.UnixMilli(),
		ZoneID:             e.ZoneID,
		RequestID:          e.RequestID,
		PolicySetVersionID: e.PolicySetVersionID,
		Decision:           e.Decision,
		MetadataVersion:    "1.7.0",
		ProductName:        "caracal",
	}
}
