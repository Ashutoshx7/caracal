---
description: "Use when mapping an external provider dashboard, OAuth client, API key, bearer token, connector, or provider setup to Caracal Console provider fields."
---
# Provider Mapping

- Read `.github/console-fields.ground-truth.json` before mapping.
- Ask for exact provider dashboard labels, helper text, placeholders, section headings, selected provider type, and setup steps.
- Ask whether the provider is creating a client, application, API key, token, secret, or connector.
- Validate with `https://docs.caracal.run` and official provider docs.
- Map provider terminology only to visible Caracal Console provider fields.
- Keep provider credentials off resource fields.
- Never reveal raw secrets.

Output one mapping block per field:

- UI label:
- Caracal field:
- Meaning:
- Required or optional:
- Expected value:
- Notes:
- Secret handling:
