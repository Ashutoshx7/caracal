---
description: "Use when writing production-ready Caracal Rego policies after requirements and input fields are verified."
---
# Rego Authoring

- Use `package caracal.authz`.
- Use `import rego.v1`.
- Start with a deny-by-default `result`.
- Return `decision`, `evaluation_status`, `determining_policies`, and `diagnostics`.
- Check resource identifiers and requested scopes explicitly.
- Add actor, subject, session, grant, or delegation checks only when verified.
- Use time-based rules only when the relevant time or window is supplied in documented policy input.
- Keep logic deterministic and side-effect free.
- Provide representative allow and deny simulation cases.

Do not use network calls, wall-clock time, random values, runtime filesystem access, or invented fields.
