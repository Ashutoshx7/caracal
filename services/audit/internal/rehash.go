// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// One-time per-zone audit chain rehash re-anchoring content hashes to the stored canonical representation.

package internal

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

// RehashChains recomputes content_sha256, prev_content_sha256, and chain_hmac
// for every stored event once. Rows written before canonical hashing landed
// were hashed over raw wire bytes that jsonb normalisation and timestamptz
// microsecond precision made unrecoverable, so the tamper sweep could never
// verify them. Re-anchoring the chain to the stored representation restores
// end-to-end verifiability; the marker row in audit_chain_rehash makes the
// pass run exactly once per database.
func (w *PGWriter) RehashChains(ctx context.Context, log zerolog.Logger) error {
	var done bool
	err := w.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM audit_chain_rehash)`).Scan(&done)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "42P01" {
			log.Warn().Msg("audit_chain_rehash table missing; run migrations before rehash")
			return nil
		}
		return err
	}
	if done {
		return nil
	}

	zones, err := w.db.Query(ctx, `SELECT DISTINCT zone_id FROM audit_events`)
	if err != nil {
		return err
	}
	zoneIDs := []string{}
	for zones.Next() {
		var z string
		if err := zones.Scan(&z); err != nil {
			zones.Close()
			return err
		}
		zoneIDs = append(zoneIDs, z)
	}
	zones.Close()
	if err := zones.Err(); err != nil {
		return err
	}

	total := 0
	for _, zoneID := range zoneIDs {
		n, err := w.rehashZone(ctx, zoneID)
		if err != nil {
			return err
		}
		total += n
	}

	if _, err := w.db.Exec(ctx, `INSERT INTO audit_chain_rehash (id) VALUES (1) ON CONFLICT (id) DO NOTHING`); err != nil {
		return err
	}
	log.Info().Int("zones", len(zoneIDs)).Int("events", total).Msg("audit chain rehash complete")
	return nil
}

func (w *PGWriter) rehashZone(ctx context.Context, zoneID string) (int, error) {
	tx, err := w.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	// Same per-zone advisory lock as Insert so ingest never observes a
	// partially rewritten chain head.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, zoneID); err != nil {
		return 0, err
	}

	rows, err := tx.Query(ctx,
		`SELECT id, zone_id, event_type,
		        COALESCE(request_id,''), COALESCE(decision,''),
		        COALESCE(policy_set_id,''), COALESCE(policy_set_version_id,''),
		        COALESCE(manifest_sha,''), COALESCE(evaluation_status,''),
		        COALESCE(determining_policies_json::text,'null'),
		        COALESCE(diagnostics_json::text,'null'),
		        COALESCE(metadata_json::text,'null'),
		        occurred_at
		 FROM audit_events WHERE zone_id = $1
		 ORDER BY chain_seq`, zoneID)
	if err != nil {
		return 0, err
	}

	type rewrite struct {
		id         string
		occurredAt time.Time
		content    string
		prev       string
		hmac       string
	}
	updates := []rewrite{}
	prevHash := ""
	for rows.Next() {
		var ev AuditEvent
		var det, diag, meta string
		if err := rows.Scan(
			&ev.ID, &ev.ZoneID, &ev.EventType,
			&ev.RequestID, &ev.Decision,
			&ev.PolicySetID, &ev.PolicySetVersionID,
			&ev.ManifestSHA, &ev.EvaluationStatus,
			&det, &diag, &meta,
			&ev.OccurredAt,
		); err != nil {
			rows.Close()
			return 0, err
		}
		ev.DeterminingPoliciesJSON = []byte(det)
		ev.DiagnosticsJSON = []byte(diag)
		ev.MetadataJSON = []byte(meta)
		content := contentHash(ev)
		updates = append(updates, rewrite{
			id:         ev.ID,
			occurredAt: ev.OccurredAt,
			content:    content,
			prev:       prevHash,
			hmac:       w.computeHMAC(content, prevHash),
		})
		prevHash = content
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	batch := &pgx.Batch{}
	for _, u := range updates {
		batch.Queue(
			`UPDATE audit_events
			 SET content_sha256 = $1, prev_content_sha256 = $2, chain_hmac = $3
			 WHERE id = $4 AND occurred_at = $5`,
			u.content, nullEmpty(u.prev), u.hmac, u.id, u.occurredAt)
	}
	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return 0, err
	}
	return len(updates), tx.Commit(ctx)
}
