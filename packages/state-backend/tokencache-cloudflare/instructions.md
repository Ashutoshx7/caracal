# tokencache-cloudflare

## Scope
- Covers the per-language Cloudflare-backed token cache binding.

## Required
- Each language subdirectory must implement the token cache interface against Cloudflare KV.

## Forbidden
- Must not host token state, transport, or framework logic.
