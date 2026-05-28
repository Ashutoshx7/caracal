-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes unused and disconnected resource-side configuration.

ALTER TABLE resources
    DROP COLUMN IF EXISTS prefix;

DROP TABLE IF EXISTS application_dependencies;
DROP TABLE IF EXISTS resource_rate_limits;
