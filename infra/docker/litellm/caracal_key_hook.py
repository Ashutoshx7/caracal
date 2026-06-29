# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Maps the gateway-injected upstream key (the bearer LiteLLM parses as the caller key) to the LiteLLM api_key, so the sealed Caracal key reaches the provider with no proxy-side keys or per-user setup.

from litellm.integrations.custom_logger import CustomLogger


class CaracalKeyHook(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        key = getattr(user_api_key_dict, "api_key", None)
        if key:
            data["api_key"] = key
        return data


caracal_key_hook = CaracalKeyHook()
