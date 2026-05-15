# engine

## Scope
- Covers the `@caracalai/engine` package: the shared engine used by the Caracal CLI and TUI.
- Owns the non-HTTP execution layer: process control (`runExec`), stack lifecycle, runtime install + embedded assets, OAuth step-up exchange, token + env scrubbing, coordinator guards, and admin verb pass-throughs.
- HTTP admin verbs live in `@caracalai/admin`; CLI and TUI call them directly.

## Required
- Each public function must be a pure async function that accepts a typed options object and returns the unformatted result.
- Throw `AdminApiError` or plain `Error`s on failure; let callers decide how to surface them.
- Streaming functions must accept an `onLine: (line: string) => void` callback and return a `{ dispose }` handle.
- Positional CLI arguments and option flags must surface as fields on the typed options object — callers do all flag parsing.
- Token-bearing strings written through the package must pass through `scrubTokens`.
- Generated bundle `src/embedded.ts` is produced by `scripts/build-embedded.mjs` from `runtime/compose.yml` and `runtime/.env.example`; regenerate before every build (wired through `prebuild` and `pretypecheck`).

## Forbidden
- Must not parse argv or flags.
- Must not write to stdout, stderr, or the terminal.
- Must not call `process.exit`.
- Must not import from `apps/` or any CLI/TUI-specific runtime layer.
- Must not embed credentials or read disk state outside what callers explicitly request.
