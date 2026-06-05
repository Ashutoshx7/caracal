---
description: "Use after user confirmation to implement the Caracal SDK integration with complete, production-grade code, minimal native changes, and official APIs."
---
# Safe Implementation

- Confirm the user approved the integration approach.
- Verify SDK docs and version compatibility against official sources.
- Reuse existing files, modules, services, configuration, dependency injection, middleware, and framework conventions. Do not perform broad refactorings.
- Use only real SDK components and verified, official APIs. Never invent methods or signatures.
- Write fully functional, complete integrations. Do not write mockup code or comments like `// TODO: implement later`.
- Store secrets in environment variables or the user's existing secret manager. Never expose or hardcode credentials.
- Run existing validation, compilation, or testing commands.
- Summarize changes made and outline remaining user configuration steps.
