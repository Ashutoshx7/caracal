// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Postgres-backed cache of zone/resource→application bindings; revision polling keeps it fresh.

package internal

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const defaultBindingPollInterval = 30 * time.Second
const bindingReloadAttempts = 5

type bindingQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// binding is the resolved identity for a proxied resource: zone scoping and the
// application id that the gateway exchanges as.
type binding struct {
	ZoneID        string
	ApplicationID string
}

// bindingStore caches zone/resource→application rows from
// gateway_resource_bindings and refreshes them on the configured cadence.
// Lookups are wait-free against the cached snapshot, so a slow Postgres does
// not block the proxy hot path.
type bindingStore struct {
	pool         bindingQuerier
	log          zerolog.Logger
	pollInterval time.Duration
	cache        atomic.Pointer[map[string]binding]
	revision     atomic.Int64
	mu           sync.Mutex
}

func newBindingStore(pool *pgxpool.Pool, log zerolog.Logger) *bindingStore {
	s := &bindingStore{pool: pool, log: log, pollInterval: defaultBindingPollInterval}
	empty := map[string]binding{}
	s.cache.Store(&empty)
	return s
}

// Get returns the binding for zone/resource, or zero binding with ok=false if none exists.
func (s *bindingStore) Get(zoneID, resource string) (binding, bool) {
	m := *s.cache.Load()
	b, ok := m[bindingKey(zoneID, resource)]
	return b, ok
}

// Size returns the number of bindings currently cached.
func (s *bindingStore) Size() int {
	return len(*s.cache.Load())
}

// Reload re-reads every binding row in a single query and atomically swaps the cache.
// Errors leave the previous snapshot in place so a flaky DB does not blank the gateway.
func (s *bindingStore) Reload(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for attempt := 0; attempt < bindingReloadAttempts; attempt++ {
		before, err := s.currentRevision(ctx)
		if err != nil {
			return err
		}
		out, err := s.loadBindings(ctx)
		if err != nil {
			return err
		}
		after, err := s.currentRevision(ctx)
		if err != nil {
			return err
		}
		if before == after {
			s.cache.Store(&out)
			s.revision.Store(after)
			return nil
		}
	}
	return errors.New("gateway bindings changed during reload")
}

func (s *bindingStore) ReloadIfChanged(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	revision, err := s.currentRevision(ctx)
	if err != nil {
		return err
	}
	if revision == s.revision.Load() {
		return nil
	}
	for attempt := 0; attempt < bindingReloadAttempts; attempt++ {
		out, err := s.loadBindings(ctx)
		if err != nil {
			return err
		}
		after, err := s.currentRevision(ctx)
		if err != nil {
			return err
		}
		if revision == after {
			s.cache.Store(&out)
			s.revision.Store(after)
			return nil
		}
		revision = after
	}
	return errors.New("gateway bindings changed during incremental reload")
}

func (s *bindingStore) loadBindings(ctx context.Context) (map[string]binding, error) {
	rows, err := s.pool.Query(ctx, `SELECT resource_identifier, zone_id, application_id FROM gateway_resource_bindings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]binding)
	for rows.Next() {
		var resource string
		var b binding
		if err := rows.Scan(&resource, &b.ZoneID, &b.ApplicationID); err != nil {
			return nil, err
		}
		out[bindingKey(b.ZoneID, resource)] = b
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *bindingStore) currentRevision(ctx context.Context) (int64, error) {
	rows, err := s.pool.Query(ctx, `SELECT version FROM gateway_binding_revision WHERE id = true`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return 0, err
		}
		return 0, errors.New("gateway binding revision row missing")
	}
	var revision int64
	if err := rows.Scan(&revision); err != nil {
		return 0, err
	}
	if rows.Next() {
		return 0, errors.New("gateway binding revision returned multiple rows")
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if revision < 0 {
		return 0, fmt.Errorf("gateway binding revision is negative: %d", revision)
	}
	return revision, nil
}

func bindingKey(zoneID, resource string) string {
	return zoneID + "\x00" + resource
}

// StartPolling refreshes the cache on every tick until ctx is cancelled. Each failure
// is logged but does not stop the loop; the previous snapshot keeps serving lookups.
func (s *bindingStore) StartPolling(ctx context.Context) {
	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := s.ReloadIfChanged(ctx); err != nil {
				s.log.Error().Err(err).Msg("gateway bindings refresh failed")
			}
		case <-ctx.Done():
			return
		}
	}
}
