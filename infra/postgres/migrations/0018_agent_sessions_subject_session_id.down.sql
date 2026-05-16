-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores the previous agent session subject reference column name.

DROP INDEX IF EXISTS agent_sessions_subject_session_id_idx;
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'agent_sessions' AND column_name = 'subject_session_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'agent_sessions' AND column_name = 'session_sid'
	) THEN
		ALTER TABLE agent_sessions RENAME COLUMN subject_session_id TO session_sid;
	END IF;
END
$$;
CREATE INDEX IF NOT EXISTS agent_sessions_session_sid_idx ON agent_sessions(session_sid);