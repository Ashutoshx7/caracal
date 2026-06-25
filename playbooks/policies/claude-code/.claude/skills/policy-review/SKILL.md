---
name: policy-review
description: Use to review Caracal policy data documents for data document shape, platform decision contract alignment, least privilege, deterministic data, and activation readiness.
---
# Policy Review

## Procedure

1. Verify `package caracal.authz` and `import rego.v1`.
2. Verify the platform decision contract denies by default and that data only grants or narrows.
3. Verify the document defines only `app_ids`, `grants`, `confinement`, `restrict`, `risk`, or `approval_tiers` and never a `result` rule.
4. Check resource and scope conditions for least privilege.
5. Check actor, subject, session, grant, and delegation conditions.
6. Check that every tier in `approval_tiers` is classified by `risk` and that gated scopes are meant to require human approval.
7. Identify undocumented input fields.
8. Identify nondeterministic or side-effecting logic.
9. Identify cases where a simpler grant, confinement, or restriction shape would be safer.
10. Recommend validation, simulation, policy-set activation, and audit checks.

Only report issues that affect correctness, safety, maintainability, or production readiness.
