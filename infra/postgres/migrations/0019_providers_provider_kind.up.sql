-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Moves provider kind into an explicit provider column.

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS provider_kind TEXT CHECK (provider_kind IS NULL OR provider_kind IN ('oauth2', 'oidc', 'apikey', 'workload'));

UPDATE providers
SET provider_kind = config_json->>'kind',
    config_json = config_json - 'kind'
WHERE config_json ? 'kind';