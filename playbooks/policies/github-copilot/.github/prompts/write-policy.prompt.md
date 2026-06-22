---
description: "Author a Caracal-compatible policy data document after requirements and inputs are verified."
argument-hint: "Confirmed requirement, verified input fields, and expected allow/deny behavior"
tools: [read, search, web]
---
# Write Caracal Policy

Author a production-ready Caracal policy data document.

Use:

- the `# caracal:data-document` directive on the first line
- `package caracal.authz`
- `import rego.v1`
- only `app_ids`, `grants`, `confinement`, or `restrict` data; never a `result` rule

Return:

- Policy Summary:
- Assumptions:
- Policy Data:
- Validation:

Use only documented or supplied input fields.
