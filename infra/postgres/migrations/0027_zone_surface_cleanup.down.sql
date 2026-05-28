-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores legacy Zone configuration fields for rollback.

ALTER TABLE zones
    ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS pkce_required BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS login_flow TEXT NOT NULL DEFAULT 'default';
