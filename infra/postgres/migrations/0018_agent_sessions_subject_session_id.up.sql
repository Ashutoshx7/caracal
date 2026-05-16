-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Renames agent session subject references for explicit coordinator semantics.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'agent_sessions' AND column_name = 'session_sid'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'agent_sessions' AND column_name = 'subject_session_id'
	) THEN
		ALTER TABLE agent_sessions RENAME COLUMN session_sid TO subject_session_id;
	END IF;
END
$$;

DROP INDEX IF EXISTS agent_sessions_session_sid_idx;
CREATE INDEX IF NOT EXISTS agent_sessions_subject_session_id_idx ON agent_sessions(subject_session_id);