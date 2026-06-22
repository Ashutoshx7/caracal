-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverses the resource operation-authority columns; development and CI only, never invoked by production tooling.

ALTER TABLE public.resources
    DROP CONSTRAINT IF EXISTS resources_operation_enforcement_check;

ALTER TABLE public.resources
    DROP COLUMN IF EXISTS operation_enforcement,
    DROP COLUMN IF EXISTS operations;
