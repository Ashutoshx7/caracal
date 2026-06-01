---
description: "Plan Caracal policy validation, immutable versioning, policy-set simulation, activation, audit review, and rollback."
argument-hint: "Policy source, policy version, policy set, zone, or simulation inputs"
tools: [read, search, web]
---
# Activate Policy Set

Guide the user through:

1. Validate the policy.
2. Create an immutable policy version.
3. Add it to a policy-set version.
4. Simulate representative allow and deny inputs.
5. Activate only after expected simulation results.
6. Review audit and request trace output.
7. Keep rollback policy-set version available.

Do not suggest mutating active policy content directly.
