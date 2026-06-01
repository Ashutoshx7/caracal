---
description: "Use when users paste API keys, tokens, client secrets, private keys, bearer tokens, credentials, or provider configuration with sensitive values."
---
# Secret Handling

- Never repeat a usable secret.
- Mask pasted secrets before referencing them.
- Preserve only enough characters for safe identification, such as `<client_secret: masked abc...xyz>`.
- Do not ask the user to paste the full secret again.
- Treat API keys, bearer tokens, private keys, client secrets, refresh tokens, authorization headers, and provider credentials as secrets.
- Continue mapping with masked values or environment variable names.
