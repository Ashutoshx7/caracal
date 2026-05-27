# Caracal OAuth for Python

Python RFC 8693 token exchange client for Caracal STS.

```python
from caracalai_oauth import ExchangeOptions, OAuthClient

client = OAuthClient("https://sts.example.com", "zone1", "app1")
token = await client.exchange(
    subject_token,
    "resource://api",
    ExchangeOptions(client_secret="client-secret", scopes=["read"]),
)
```

Successful responses are validated before caching. Cache keys isolate subject tokens, actor tokens, session/delegation context, scopes, TTL, and client authentication context. The default cache is in-memory and process-local.

Docs: https://caracal.run/sdks/oauth/
