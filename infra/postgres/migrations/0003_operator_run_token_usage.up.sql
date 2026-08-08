-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Persists the model usage already calculated for each durable Operator message run.

ALTER TABLE public.operator_message_runs
    ADD COLUMN input_tokens bigint DEFAULT 0 NOT NULL,
    ADD COLUMN output_tokens bigint DEFAULT 0 NOT NULL,
    ADD COLUMN served_provider_id text,
    ADD COLUMN served_model text,
    ADD CONSTRAINT operator_message_runs_input_tokens_check CHECK (input_tokens >= 0),
    ADD CONSTRAINT operator_message_runs_output_tokens_check CHECK (output_tokens >= 0);
