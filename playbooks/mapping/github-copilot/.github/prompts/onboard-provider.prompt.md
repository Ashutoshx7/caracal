---
description: "Guide onboarding a new provider by identifying provider-side setup and Caracal Console fields."
argument-hint: "Provider name and desired authentication flow"
tools: [read, search, web]
---
# Onboard Provider

Help the user prepare provider-side setup before filling Caracal Console.

Steps:

1. Ask which provider and auth flow they need.
2. Ask whether they are creating a client, application, API key, token, secret, or connector.
3. Read `.github/console-fields.ground-truth.json`.
4. Check provider docs and Caracal docs.
5. Tell the user which visible Caracal Console field receives each provider value.

Never ask for raw secrets in chat.
