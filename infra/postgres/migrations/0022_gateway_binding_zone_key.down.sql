-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restore legacy global resource identifier uniqueness for Gateway bindings.

ALTER TABLE gateway_resource_bindings
    DROP CONSTRAINT IF EXISTS gateway_resource_bindings_pkey;

DELETE FROM gateway_resource_bindings a
USING gateway_resource_bindings b
WHERE a.resource_identifier = b.resource_identifier
  AND a.ctid > b.ctid;

ALTER TABLE gateway_resource_bindings
    ADD PRIMARY KEY (resource_identifier);
