-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes unused Zone configuration fields from the production schema.

ALTER TABLE zones
    DROP COLUMN IF EXISTS org_id,
    DROP COLUMN IF EXISTS pkce_required,
    DROP COLUMN IF EXISTS login_flow;
