-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds a per-conversation operation mode to the Operator so a conversation can be made provably write-incapable (ask) or allowed to plan and apply changes (agent).

ALTER TABLE public.operator_conversations
    ADD COLUMN mode text DEFAULT 'agent'::text NOT NULL
    CONSTRAINT operator_conversations_mode_check CHECK ((mode = ANY (ARRAY['ask'::text, 'agent'::text])));
