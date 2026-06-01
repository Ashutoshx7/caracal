---
description: "Validate a completed Caracal provider or resource configuration against visible Console fields and docs."
argument-hint: "Redacted provider/resource configuration or field list"
tools: [read, search, web]
---
# Validate Configuration

Review the completed setup.

Steps:

1. Mask any raw secrets before analysis.
2. Read `.github/console-fields.ground-truth.json`.
3. Check each value against visible Console fields.
4. Validate field behavior with Caracal docs and provider docs.
5. Report missing, unsupported, misplaced, ambiguous, or unverified values.

Keep the review short and field-focused.
