---
description: "Use when reviewing Caracal Rego policies for decision contract compliance, deny-by-default behavior, least privilege, deterministic logic, and activation readiness."
---
# Policy Review

- Verify `package caracal.authz` and `import rego.v1`.
- Verify deny-by-default behavior.
- Verify the result contract includes `decision`, `evaluation_status`, `determining_policies`, and `diagnostics`.
- Check resource and scope conditions for least privilege.
- Check actor, subject, session, grant, and delegation conditions.
- Identify undocumented input fields.
- Identify nondeterministic or side-effecting logic.
- Recommend validation, simulation, policy-set activation, and audit checks.

Only report issues that affect correctness, safety, maintainability, or production readiness.
