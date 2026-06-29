# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Maps the gateway-injected key and the operator's real endpoint into the LiteLLM call, so any OpenAI-compatible provider works with no per-model config: the sealed key becomes api_key and X-Llm-Upstream becomes api_base.

from litellm.integrations.custom_logger import CustomLogger


class CaracalKeyHook(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        key = getattr(user_api_key_dict, "api_key", None)
        if key:
            data["api_key"] = key
        headers = (data.get("metadata") or {}).get("headers") or {}
        upstream = headers.get("x-llm-upstream")
        if upstream:
            data["api_base"] = upstream
        return data


caracal_key_hook = CaracalKeyHook()
