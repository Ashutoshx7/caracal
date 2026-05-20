-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes heartbeat lease tracking for service agent sessions.

DROP INDEX IF EXISTS agent_sessions_service_heartbeat_deadline_idx;

ALTER TABLE agent_sessions
    DROP COLUMN IF EXISTS heartbeat_deadline_at,
    DROP COLUMN IF EXISTS last_heartbeat_at;
