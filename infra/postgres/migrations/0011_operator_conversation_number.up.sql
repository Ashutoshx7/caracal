-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Gives each Operator conversation a per-zone sequential number so a chat has a stable, human-readable id that can address it in the console URL.

ALTER TABLE public.operator_conversations
    ADD COLUMN number bigint;

-- Backfill existing conversations with a per-zone running number in creation order, so a
-- deployment upgraded in place keeps every chat addressable from the first numbered build.
WITH ordered AS (
    SELECT id, row_number() OVER (PARTITION BY zone_id ORDER BY created_at, id) AS rn
    FROM public.operator_conversations
)
UPDATE public.operator_conversations c
SET number = ordered.rn
FROM ordered
WHERE c.id = ordered.id;

CREATE UNIQUE INDEX operator_conversations_zone_number_idx
    ON public.operator_conversations (zone_id, number);
