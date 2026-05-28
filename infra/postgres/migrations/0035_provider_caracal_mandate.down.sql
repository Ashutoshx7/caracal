-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes the Caracal mandate provider kind from the provider constraint.

UPDATE providers
SET provider_kind = 'bearer_token',
    archived_at = COALESCE(archived_at, now()),
    updated_at = now()
WHERE provider_kind = 'caracal_mandate';

ALTER TABLE providers
    DROP CONSTRAINT IF EXISTS providers_provider_kind_check;

ALTER TABLE providers
    ADD CONSTRAINT providers_provider_kind_check CHECK (
        provider_kind IN ('oauth2_authorization_code', 'oauth2_client_credentials', 'api_key', 'bearer_token')
    );
