-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes obsolete Application credential variants and unused tracking columns.

UPDATE applications
SET archived_at = COALESCE(archived_at, now())
WHERE credential_type IS DISTINCT FROM 'token';

UPDATE applications
SET credential_type = 'token'
WHERE credential_type IS NULL;

ALTER TABLE applications
    ALTER COLUMN credential_type SET DEFAULT 'token',
    ALTER COLUMN credential_type SET NOT NULL;

ALTER TABLE applications
    DROP CONSTRAINT IF EXISTS applications_credential_type_check;

ALTER TABLE applications
    ADD CONSTRAINT applications_credential_type_check CHECK (credential_type = 'token');

ALTER TABLE applications
    DROP COLUMN IF EXISTS last_active_at,
    DROP COLUMN IF EXISTS updated_at;
