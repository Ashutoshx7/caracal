-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores legacy resource-side configuration for rollback.

ALTER TABLE resources
    ADD COLUMN IF NOT EXISTS prefix BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS application_dependencies (
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    resource_id    TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    PRIMARY KEY (application_id, resource_id)
);

CREATE TABLE IF NOT EXISTS resource_rate_limits (
    zone_id          TEXT NOT NULL REFERENCES zones(id),
    resource_id      TEXT NOT NULL REFERENCES resources(id),
    window_seconds   INT NOT NULL CHECK (window_seconds > 0),
    max_requests     BIGINT NOT NULL CHECK (max_requests > 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (zone_id, resource_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON application_dependencies TO caracalApi;
GRANT SELECT ON application_dependencies TO caracalSts;
GRANT SELECT, INSERT, UPDATE ON resource_rate_limits TO caracalApi;
GRANT SELECT ON resource_rate_limits TO caracalSts, caracalCoordinator;

ALTER TABLE resource_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY zone_isolation ON resource_rate_limits
    USING (current_setting('caracal.zone_id', true) = '*' OR zone_id = current_setting('caracal.zone_id', true))
    WITH CHECK (current_setting('caracal.zone_id', true) = '*' OR zone_id = current_setting('caracal.zone_id', true));
