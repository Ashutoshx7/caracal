-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds the Caracal mandate provider kind for Gateway-forwarded internal resources.

ALTER TABLE providers
    DROP CONSTRAINT IF EXISTS providers_provider_kind_check;

ALTER TABLE providers
    ADD CONSTRAINT providers_provider_kind_check CHECK (
        provider_kind IN ('caracal_mandate', 'oauth2_authorization_code', 'oauth2_client_credentials', 'api_key', 'bearer_token')
    );
