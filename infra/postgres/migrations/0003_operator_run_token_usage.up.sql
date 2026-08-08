-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Persists the model usage already calculated for each durable Operator message run.

ALTER TABLE public.operator_message_runs
    ADD COLUMN input_tokens bigint DEFAULT 0 NOT NULL,
    ADD COLUMN output_tokens bigint DEFAULT 0 NOT NULL,
    ADD COLUMN usage_by_provider_model jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN served_provider_id text,
    ADD COLUMN served_model text;

-- NOT VALID makes each check enforce new writes immediately without holding the stronger ALTER
-- lock while PostgreSQL scans existing runs. Validation uses a lower lock in its own statement.
ALTER TABLE public.operator_message_runs
    ADD CONSTRAINT operator_message_runs_input_tokens_check CHECK (input_tokens >= 0) NOT VALID,
    ADD CONSTRAINT operator_message_runs_output_tokens_check CHECK (output_tokens >= 0) NOT VALID,
    ADD CONSTRAINT operator_message_runs_usage_by_provider_model_check
        CHECK (jsonb_typeof(usage_by_provider_model) = 'array') NOT VALID;

ALTER TABLE public.operator_message_runs
    VALIDATE CONSTRAINT operator_message_runs_input_tokens_check;

ALTER TABLE public.operator_message_runs
    VALIDATE CONSTRAINT operator_message_runs_output_tokens_check;

ALTER TABLE public.operator_message_runs
    VALIDATE CONSTRAINT operator_message_runs_usage_by_provider_model_check;
