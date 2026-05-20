-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Gateway bindings are unique per zone and resource identifier.

ALTER TABLE gateway_resource_bindings
    DROP CONSTRAINT IF EXISTS gateway_resource_bindings_pkey;

ALTER TABLE gateway_resource_bindings
    ADD PRIMARY KEY (zone_id, resource_identifier);
