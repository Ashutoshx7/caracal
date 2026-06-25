---
name: rego-authoring
description: "Use to author production-ready Caracal policy data documents after requirements and input fields are verified."
---
# Rego Authoring

## Procedure

1. Start with the `# caracal:data-document` directive on the first line.
2. Use `package caracal.authz`.
3. Use `import rego.v1`.
4. Define only `app_ids`, `grants`, `confinement`, `restrict`, `risk`, or `approval_tiers` data; never author a `result` rule.
5. Map resource identifiers and scopes in `grants` explicitly.
6. Add `confinement` or `restrict` overlays only when the narrowing is verified.
7. Keep `confinement` and `restrict` deny-only so they never widen authority.
8. Add `risk` and `approval_tiers` only when high-risk scopes must hold a mint behind human approval; they add a gate, never authority.
9. Keep data static, deterministic, and side-effect free.
10. Provide representative allow and deny simulation cases.
11. Explain the document's effect in simple language when the mapping is not obvious.

Do not use network calls, wall-clock time, random values, runtime filesystem access, or invented fields.
