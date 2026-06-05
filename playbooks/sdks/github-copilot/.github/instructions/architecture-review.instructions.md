---
description: "Use when reviewing language, framework, runtime, agentic frameworks, middleware, routing, custom providers, dependency injection, configuration, and deployment before SDK integration."
---
# Architecture Review

- Determine language, framework, runtime environment, package manager, and deployment model.
- Identify specific agentic frameworks and libraries (e.g., LangChain, LlamaIndex, Semantic Kernel, custom prompt/tool execution loops) present in the codebase.
- Map project structure, service boundaries, middleware, routing, dependency injection, and configuration patterns.
- Map any custom provider APIs and trace how external third-party calls are routed.
- Identify existing authentication, authorization, token exchange, and credential flows.
- Verify version compatibility of target frameworks against official Caracal SDK documentation.
- Identify where Caracal naturally fits (e.g. middleware, transport wrapping, or client-secret exchanges) and areas to avoid.
- Prefer existing files and patterns over introducing new abstract directories or wrappers.

Return recommended and optional integration points, detailing the rationale behind each.
