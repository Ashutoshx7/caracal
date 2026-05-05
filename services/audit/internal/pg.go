// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Append-only PostgreSQL writer for audit events.

package internal

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PGWriter struct {
	db       *pgxpool.Pool
	onInsert func()
}

func (w *PGWriter) Insert(ctx context.Context, ev AuditEvent) error {
	detPolicies, _ := json.Marshal(ev.DeterminingPolicies)
	hash := contentHash(ev)
	_, err := w.db.Exec(ctx,
		`INSERT INTO audit_events
		 (id, zone_id, event_type, request_id, decision, policy_set_id,
		  policy_set_version_id, manifest_sha, evaluation_status,
		  determining_policies_json, diagnostics_json, metadata_json, occurred_at, content_sha256)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
		 ON CONFLICT (id, occurred_at) DO NOTHING`,
		ev.ID, ev.ZoneID, ev.EventType, ev.RequestID, ev.Decision,
		ev.PolicySetID, ev.PolicySetVersionID, ev.ManifestSHA,
		ev.EvaluationStatus, string(detPolicies),
		nullableJSON(ev.Diagnostics), nullableJSON(ev.Metadata), ev.OccurredAt, hash,
	)
	if err == nil && w.onInsert != nil {
		w.onInsert()
	}
	return err
}

func (w *PGWriter) QuerySince(ctx context.Context, since, until time.Time) ([]AuditEvent, error) {
	rows, err := w.db.Query(ctx,
		`SELECT id, zone_id, event_type,
		        COALESCE(request_id,''), COALESCE(decision,''),
		        COALESCE(policy_set_id,''), COALESCE(policy_set_version_id,''),
		        COALESCE(manifest_sha,''), COALESCE(evaluation_status,''),
		        COALESCE(determining_policies_json::text,'[]'),
		        COALESCE(diagnostics_json::text,'null'),
		        COALESCE(metadata_json::text,'null'),
		        occurred_at
		 FROM audit_events WHERE occurred_at >= $1 AND occurred_at < $2
		 ORDER BY occurred_at`,
		since, until,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var ev AuditEvent
		var detJSON, diagJSON, metaJSON string
		if err := rows.Scan(
			&ev.ID, &ev.ZoneID, &ev.EventType, &ev.RequestID, &ev.Decision,
			&ev.PolicySetID, &ev.PolicySetVersionID, &ev.ManifestSHA,
			&ev.EvaluationStatus, &detJSON, &diagJSON, &metaJSON, &ev.OccurredAt,
		); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(detJSON), &ev.DeterminingPolicies)
		ev.Diagnostics = json.RawMessage(diagJSON)
		ev.Metadata = json.RawMessage(metaJSON)
		events = append(events, ev)
	}
	return events, rows.Err()
}

func (w *PGWriter) QueryContentHash(ctx context.Context, id string, occurredAt time.Time) (string, error) {
	var hash string
	err := w.db.QueryRow(ctx,
		`SELECT COALESCE(content_sha256,'') FROM audit_events WHERE id = $1 AND occurred_at = $2`,
		id, occurredAt,
	).Scan(&hash)
	return hash, err
}

func nullableJSON(v json.RawMessage) *string {
	if len(v) == 0 || string(v) == "null" {
		return nil
	}
	s := string(v)
	return &s
}

func contentHash(ev AuditEvent) string {
	canonical := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%d",
		ev.ID, ev.ZoneID, ev.EventType, ev.RequestID,
		ev.Decision, ev.PolicySetVersionID, ev.ManifestSHA,
		ev.OccurredAt.UnixNano(),
	)
	h := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(h[:])
}
