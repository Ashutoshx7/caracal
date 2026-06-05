---
name: architecture-review
description: "Use to review framework, runtime, agent frameworks, structure, middleware, services, custom providers, configuration, and integration points before Caracal SDK work."
---
# Architecture Review

## Procedure

1. **Analyze Frameworks & Runtimes**: Detect languages, framework architectures, runtimes, package managers, and deployment models.
2. **Identify Agent Frameworks**: Check for agentic patterns and libraries (e.g. LangChain, LlamaIndex, Semantic Kernel, custom prompt/tool execution loops).
3. **Map Project Structure**: Trace service boundaries, routing, middleware, dependency injection, custom provider APIs, and configuration schemas.
4. **Inspect Authentication/Authorization**: Identify existing token exchanges, middleware, and credential verification pathways.
5. **Evaluate Compatibility**: Look up official documentation if compatibility questions arise between Caracal and current frameworks or packages.
6. **Determine Touchpoints**: Identify where Caracal naturally fits (e.g., as middleware, transport wrapping, or client-secret exchanges) and areas to avoid.
7. **Keep it Thin**: Prefer fitting into existing codebase patterns rather than introducing new directory structures or abstract wrappers.

Return recommended and optional integration points, detailing the rationale behind each.
