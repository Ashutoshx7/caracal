---
description: "Safely review a user-provided provider or resource setup, screenshot text, or field/value list."
argument-hint: "Redacted setup details, screenshot text, or field/value list"
tools: [read, search, web]
---
# Review Setup

Review the user's setup safely.

Steps:

1. Mask secrets immediately.
2. Separate provider credential values from resource target values.
3. Match fields against `.github/console-fields.ground-truth.json`.
4. Use docs to confirm meanings.
5. Provide concise corrections and next fields to fill.

If a required field is unsupported, link the Caracal issue form.
