---
description: "Map a Caracal resource form to visible Console resource fields."
argument-hint: "Resource form labels, scopes, upstream URL, provider binding"
tools: [read, search, web]
---
# Map Resource

Map the resource form fields to Caracal Console resource fields.

Steps:

1. Read `.github/console-fields.ground-truth.json`.
2. Ask for missing labels, helper text, placeholders, selected provider, scopes, and upstream target.
3. Validate with Caracal docs.
4. Keep resource values separate from provider credential values.
5. Return the standard field mapping format.
