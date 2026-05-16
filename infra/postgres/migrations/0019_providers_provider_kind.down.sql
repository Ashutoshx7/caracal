-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores provider kind to provider public config.

UPDATE providers
SET config_json = config_json || jsonb_build_object('kind', provider_kind)
WHERE provider_kind IS NOT NULL;

ALTER TABLE providers
    DROP COLUMN IF EXISTS provider_kind;