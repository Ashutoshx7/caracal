# caracal run OpenAI research agent

This is the primary `caracal run` showcase example. It demonstrates a realistic
external agent workflow where Caracal launches an unmodified OpenAI-compatible
agent and injects the credential only for that process lifetime.

The agent has no Caracal SDK dependency. It behaves like a normal third-party
tool: read `OPENAI_API_KEY`, call an OpenAI-compatible Chat Completions endpoint,
print a result, and exit.

## Scenario

A team wants to run a vendor agent against a private task without copying an
OpenAI key into `.env`, shell history, CI variables, or the agent repository.
Caracal owns the credential and launches the agent like this:

```bash
caracal run -- node agent.mjs --base-url=https://api.openai.com/v1 "Summarize today's incident report"
```

At runtime Caracal exchanges `resource://openai` for a short-lived credential,
injects it as `OPENAI_API_KEY`, starts the agent, and removes the credential when
the process exits.

## What this proves

| Behavior | Demonstrated by |
| --- | --- |
| Runtime-only injection | `agent.mjs` fails unless `OPENAI_API_KEY` is injected by `caracal run` |
| No `.env` fallback | The example has no `.env`; tests verify direct execution fails |
| Scoped access | The mock STS only mints credentials for `resource://openai` |
| Short-lived usage | The mock provider rejects expired credentials |
| External agent execution | `agent.mjs` imports no Caracal package and only reads normal OpenAI config |
| Secret scrubbing | Tests verify `CARACAL_ADMIN_TOKEN` and `CARACAL_APP_CLIENT_SECRET` do not reach the child |
| Env allowlist clarity | Tests verify arbitrary env vars such as `OPENAI_BASE_URL` are not inherited |

## Files

| File | Purpose |
| --- | --- |
| `agent.mjs` | A plain OpenAI-compatible research agent launched by `caracal run` |
| `_mock/server.mjs` | Local deterministic STS plus OpenAI-compatible provider mock |
| `tests/agent.test.mjs` | End-to-end tests that run the real monorepo `caracal run` launcher |
| `package.json` | Self-contained test command for this example |

## Flow

```text
caracal run -- node agent.mjs --base-url=<provider>/v1 "task"
  |
  |-- loads the run identity and resource mapping
  |-- exchanges resource://openai at STS
  |     `-- receives a short-lived scoped token
  |-- injects OPENAI_API_KEY into the child process only
  |-- strips Caracal admin/bootstrap secrets from the child env
  `-- starts node agent.mjs
        |
        `-- calls <provider>/v1/chat/completions with Authorization: Bearer <token>
```

The local mock uses one HTTP server for both roles so the example is deterministic:

- `POST /oauth/2/token` acts as STS and mints a token for `resource://openai`.
- `POST /v1/chat/completions` acts as OpenAI and accepts only a minted,
  unexpired, in-scope token.

## Run the example

From this directory:

```bash
pnpm test
```

Or without package scripts:

```bash
node --test "tests/**/*.test.mjs"
```

The tests use `apps/runtime/bin/caracal.mjs` from the monorepo by default. To test
an already-built binary, set `CARACAL_BIN`:

```bash
CARACAL_BIN=/path/to/caracal pnpm test
```

No network access and no real OpenAI key are required.

## Test coverage

The test suite covers the intended `run` contract:

1. A full two-call agent workflow succeeds with an injected key.
2. Caracal admin/bootstrap secrets are scrubbed from the child process.
3. Arbitrary env vars are not forwarded to the child.
4. The injected key is the Caracal-minted scoped token.
5. Out-of-scope resources are denied before the agent starts.
6. Expired tokens are rejected by the provider.
7. Leaked but unminted bearer values are rejected.
8. Running the agent directly without `caracal run` fails.

## Mapping used by the tests

The tests pass this resource mapping through `CARACAL_RUN_CREDENTIALS`:

```json
[
  {
    "env": "OPENAI_API_KEY",
    "resource": "resource://openai"
  }
]
```

That mapping is not a secret; it only says which resource should populate which
child-process env var. The bootstrap app identity is supplied to the launcher, not
to the child.

## Why config is passed by argv

`caracal run` intentionally forwards a strict environment allowlist: platform
basics such as `PATH`, `HOME`, locale variables, plus the credentials it injects.
Arbitrary workload env vars such as `OPENAI_BASE_URL` are not inherited.

For that reason the agent accepts non-secret config via argv:

```bash
node agent.mjs --base-url=https://api.openai.com/v1 --model=gpt-4o-mini "task"
```

Only the credential travels through Caracal as environment.

## Using the pattern with real OpenAI

Real OpenAI API keys are long-lived API keys, not OAuth access tokens. If Caracal
injects a raw OpenAI key, the useful guarantees are still meaningful:

- the key is not committed to the project;
- the key is not stored in `.env`;
- the key is visible only to the launched process;
- the key disappears when the process exits.

Provider-enforced scoping and expiry require either an OAuth-style provider that
can mint scoped short-lived tokens or a Caracal-fronted broker that exchanges the
raw OpenAI key for a scoped short-lived credential. The mock in this example
models that stronger flow so the intended product shape is visible without using
live third-party services.

## Known constraints in the current implementation

- `caracal run` currently requests a 3600-second token TTL, while STS rejects a
  resource-mandate request above 900 seconds. The runtime should request a TTL at
  or below the resource cap.
- Injected env vars are static for the process lifetime. Long-running agents must
  finish before expiry or be relaunched.
- Real provider tokens are gateway-only today. Direct provider-token injection
  needs a small explicit STS/run capability, not just documentation.
- Raw API-key providers cannot be made truly provider-scoped by Caracal alone.
