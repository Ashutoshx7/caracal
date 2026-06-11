-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Tracks the one-time audit chain rehash that re-anchors content hashes to the stored canonical representation.

CREATE TABLE IF NOT EXISTS audit_chain_rehash (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
