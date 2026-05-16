# Caracal OAuth for TypeScript

TypeScript RFC 8693 token exchange client for Caracal STS.

```ts
import { OAuthClient } from '@caracalai/oauth'

const client = new OAuthClient('https://sts.example.com', 'zone1', 'app1')
const token = await client.exchange(subjectToken, 'resource://api', {
  clientSecret: 'client-secret',
  scopes: ['read'],
})
```

Successful responses are validated before caching. Cache keys isolate subject tokens, actor tokens, session/delegation context, scopes, TTL, and client authentication context. The default cache is in-memory and process-local.

