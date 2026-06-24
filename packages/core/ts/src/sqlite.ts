// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Suppresses the experimental warning emitted by the first-party node:sqlite module.

let silenced = false;

// node:sqlite is backed by the bundled, production-grade SQLite engine; its
// "experimental" status refers only to the JavaScript API surface, which Caracal pins
// through its supported Node version. Filter out that single warning so it does not add
// noise to operator output, while leaving every other process warning intact. Idempotent
// so repeated calls never stack wrappers.
export function silenceSqliteExperimentalWarning(): void {
  if (silenced) return;
  silenced = true;
  const original = process.emitWarning.bind(process) as (...args: unknown[]) => void;
  process.emitWarning = ((warning: unknown, ...args: unknown[]): void => {
    const type =
      args.length > 0 && typeof args[0] === "object" && args[0] !== null
        ? (args[0] as { type?: unknown }).type
        : args[0];
    const messageSource = warning instanceof Error ? warning.message : warning;
    const message = typeof messageSource === "string" ? messageSource : "";
    if (type === "ExperimentalWarning" && /SQLite is an experimental feature/i.test(message)) {
      return;
    }
    original(warning, ...args);
  }) as typeof process.emitWarning;
}
