-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds heartbeat lease tracking for service agent sessions.

ALTER TABLE agent_sessions
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS heartbeat_deadline_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS agent_sessions_service_heartbeat_deadline_idx
    ON agent_sessions(heartbeat_deadline_at)
    WHERE status = 'active' AND agent_kind = 'service';
