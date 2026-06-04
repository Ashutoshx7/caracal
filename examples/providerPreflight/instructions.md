# providerPreflight

## Scope
- Covers the automatable provider preflight that validates a resource, its
  provider binding, reachability, runtime-injection eligibility, and policy
  authorization before the first Gateway call.

## Architecture Design
- `preflight.mjs` holds pure check functions and an orchestrator that takes an
  injected fetch result set, DNS resolver, and origin probe.
- `run.mjs` wires the Caracal Admin API, DNS, and TCP probes into the orchestrator.

## Required
- Must use only the public Admin API surface and the Node standard library.
- Must keep check functions pure and tested offline with injected dependencies.
- Must fail closed: any failed check exits non-zero.

## Forbidden
- Must not import Caracal repository internals or call live third-party services
  from tests.
- Must not embed admin tokens, secrets, or real endpoints.

## Validation
- Run `node --test` from this directory.
