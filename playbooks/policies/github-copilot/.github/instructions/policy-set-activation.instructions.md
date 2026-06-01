---
description: "Use when guiding Caracal policy validation, immutable policy versioning, policy-set simulation, activation, audit review, and rollback planning."
---
# Policy Set Activation

- Validate the policy in Console or through the Admin API.
- Create an immutable policy version.
- Add the policy version to a policy-set version.
- Simulate representative allow and deny inputs.
- Activate only when simulation matches intended behavior.
- Review audit and request trace output after first use.
- Keep the last known-good policy-set version available for rollback.

Policies become effective through active policy-set versions, not by mutating active policy content.
