-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds the native operation-authority contract to resources: the per-operation scope map the Gateway enforces and the enforcement mode that governs unmapped operations.

ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS operations jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS operation_enforcement text DEFAULT 'transport_uniform' NOT NULL;

-- The mode is a small closed set. transport_uniform is the expand-safe default so
-- existing rows, and rows written by the previous application version during a
-- no-window upgrade, keep today's per-operation behavior; the new application
-- layer writes operation_enforcement explicitly for resources it creates.
ALTER TABLE public.resources
    ADD CONSTRAINT resources_operation_enforcement_check
    CHECK (operation_enforcement IN ('enforced', 'transport_uniform'));
