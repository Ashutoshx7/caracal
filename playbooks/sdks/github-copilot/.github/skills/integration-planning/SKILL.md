---
name: integration-planning
description: "Use to prepare a complete Caracal SDK integration plan after product and architecture discovery, before writing any code."
---
# Integration Planning

## Procedure

1. **Confirm Discovery**: Verify that product purpose, frameworks, and agent systems are fully understood.
2. **Align Outcomes**: Identify the user's desired Caracal integration goal (e.g. secure provider calls, STS token exchange).
3. **Establish Value**: Focus on real production integration value rather than basic example-only implementations.
4. **Draft Integration Points**:
   - Detail recommended integration points with their files, APIs, and dependencies.
   - Outline optional integration points.
   - Clarify what areas of the codebase must remain completely unchanged.
5. **Separate Lifecycle Hooks**: Keep Admin API bootstrapping separate from the runtime application/service logic.
6. **Plan Workarounds/Fallbacks**: If a runtime or configuration is not directly supported by the current SDK, design a thin, maintainable custom integration layer or wrapper, and document fallback steps (e.g. filing issues or contacting support).
7. **Explain Decisions & Impact**: Explicitly detail the rationale behind every recommended change and its impact on performance, security, and developer experience.
8. **Request Approval**: Present the plan using the `.github/instructions/integration-planning.instructions.md` format and obtain explicit user confirmation. Do not write code before approval.
