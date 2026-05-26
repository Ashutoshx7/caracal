-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Gateway binding revision marker for cheap cache invalidation.

CREATE TABLE gateway_binding_revision (
    id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    version    BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO gateway_binding_revision (id, version)
VALUES (true, 1);

GRANT SELECT, UPDATE ON gateway_binding_revision TO caracalApi;
GRANT SELECT ON gateway_binding_revision TO caracalGateway;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway_resource_bindings TO caracalApi;
GRANT SELECT ON gateway_resource_bindings TO caracalGateway;
