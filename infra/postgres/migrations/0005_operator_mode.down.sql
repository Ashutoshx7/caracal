-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverses the Operator conversation operation mode column; development and CI only, never invoked by production tooling.

ALTER TABLE public.operator_conversations
    DROP COLUMN IF EXISTS mode;
