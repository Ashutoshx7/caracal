-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Rollback for API admin token verification material.

ALTER TABLE admin_tokens
    DROP COLUMN IF EXISTS token_hash;
