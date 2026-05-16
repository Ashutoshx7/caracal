# Caracal OAuth for Go

Go RFC 8693 token exchange client for Caracal STS.

```go
client := oauth.NewClient("https://sts.example.com", "zone1", "app1", nil)
token, err := client.Exchange(ctx, subjectToken, "resource://api", oauth.ExchangeOptions{
    ClientSecret: "client-secret",
    Scopes: []string{"read"},
})
```

Successful responses are validated before caching. Cache keys isolate subject tokens, actor tokens, session/delegation context, scopes, TTL, and client authentication context. The default cache is in-memory and process-local.

