-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes the Gateway binding revision marker.

REVOKE SELECT, UPDATE ON gateway_binding_revision FROM caracalApi;
REVOKE SELECT ON gateway_binding_revision FROM caracalGateway;

DROP TABLE IF EXISTS gateway_binding_revision;
