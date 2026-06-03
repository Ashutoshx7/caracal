-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores team and invitation collaboration tables.

CREATE TABLE invitations (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    invited_by  TEXT NOT NULL,
    accepted_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON invitations(zone_id, email);

CREATE TABLE teams (
    id           TEXT PRIMARY KEY,
    zone_id      TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    members_json JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, name)
);
