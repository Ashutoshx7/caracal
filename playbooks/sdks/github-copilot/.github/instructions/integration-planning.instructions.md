---
description: "Use after product and architecture discovery to propose Caracal SDK integration points, explain integration decisions, and get user confirmation before implementation."
---
# Integration Planning

Before implementation, provide:

### Product & Codebase Understanding
- Product and user workflow summary.
- Frameworks, agent runtimes, and deployment patterns identified.

### Architecture & Security Flow
- Current authentication, authorization, and credential management flows.
- Integration opportunities and recommended touchpoints.

### Proposed Integration
- Recommended integration points (targeting stable/RC SDK versions).
- Expected architectural changes and expected benefits (explain design decisions and rationale).
- What should remain completely unchanged.
- Custom thin workaround layers or temporary integrations if direct support is unavailable.

### User Confirmation
Ask for explicit user confirmation before editing code. Do not implement before confirmation.
