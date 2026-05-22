-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Argon2id verification material for API admin tokens.

ALTER TABLE admin_tokens
    ADD COLUMN token_hash TEXT;
