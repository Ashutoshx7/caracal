// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared environment variable accessors for TypeScript services.

export function mustGetenv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Required env var missing: ${key}`);
  return v;
}

export function getenv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function intEnv(key: string, fallback: number, min = 0): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) {
    throw new Error(`Invalid integer env var ${key}: ${raw}`);
  }
  return n;
}

export function boolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  switch (raw.toLowerCase()) {
    case '1': case 'true': case 'yes': case 'on': return true;
    case '0': case 'false': case 'no': case 'off': return false;
    default: throw new Error(`Invalid boolean env var ${key}: ${raw}`);
  }
}
