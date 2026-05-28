-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores Application credential variants and tracking columns for rollback.

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE applications
    DROP CONSTRAINT IF EXISTS applications_credential_type_check;

ALTER TABLE applications
    ALTER COLUMN credential_type DROP DEFAULT,
    ALTER COLUMN credential_type DROP NOT NULL;

ALTER TABLE applications
    ADD CONSTRAINT applications_credential_type_check CHECK (credential_type IN ('token', 'password', 'public-key', 'url', 'public')) NOT VALID;
