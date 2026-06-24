// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Runtime configuration for the Community Edition authentication service.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveFileSecrets } from "@caracalai/core";

const here = path.dirname(fileURLToPath(import.meta.url));

const DEV_SECRET = "caracal-community-dev-secret-change-me";

// Postgres TLS posture. "disable" relies on the connection string (default for local),
// "require" enforces a verified certificate, and "no-verify" enables TLS without
// certificate verification for managed providers that present self-signed chains.
export type PostgresSsl = "disable" | "require" | "no-verify";

export type DatabaseConfig =
  | { kind: "postgres"; url: string; ssl: PostgresSsl }
  | { kind: "sqlite"; path: string };

export interface AuthConfig {
  port: number;
  baseURL: string;
  secret: string;
  webOrigin: string;
  database: DatabaseConfig;
}

function resolveDatabaseUrl(): string | undefined {
  // CARACAL_AUTH_DATABASE_URL isolates the auth schema from the control-plane database;
  // DATABASE_URL is the platform-wide fallback. Both honour the `_FILE` secret convention.
  resolveFileSecrets(["CARACAL_AUTH_DATABASE_URL", "DATABASE_URL"]);
  const url = process.env.CARACAL_AUTH_DATABASE_URL ?? process.env.DATABASE_URL;
  return url && url.trim() !== "" ? url.trim() : undefined;
}

function resolveSsl(): PostgresSsl {
  const value = (process.env.CARACAL_AUTH_DATABASE_SSL ?? "").toLowerCase();
  if (value === "require" || value === "true" || value === "verify") return "require";
  if (value === "no-verify" || value === "insecure") return "no-verify";
  return "disable";
}

function resolveDatabase(): DatabaseConfig {
  const url = resolveDatabaseUrl();
  if (url) return { kind: "postgres", url, ssl: resolveSsl() };
  const sqlitePath = process.env.CARACAL_AUTH_DB ?? path.resolve(here, "..", "caracal-auth.sqlite");
  return { kind: "sqlite", path: sqlitePath };
}

function resolveSecret(database: DatabaseConfig): string {
  resolveFileSecrets(["BETTER_AUTH_SECRET"]);
  const secret = process.env.BETTER_AUTH_SECRET ?? DEV_SECRET;
  // A predictable signing secret lets anyone forge session cookies. The SQLite path is a
  // local single-operator convenience, but a Postgres-backed deployment is a networked
  // service, so fail closed rather than sign production sessions with a public default.
  if (database.kind === "postgres" && secret === DEV_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is required for a Postgres-backed auth deployment. Set BETTER_AUTH_SECRET (or BETTER_AUTH_SECRET_FILE) to a high-entropy random value.",
    );
  }
  return secret;
}

export function loadConfig(): AuthConfig {
  const port = Number(process.env.CARACAL_AUTH_PORT ?? 3002);
  const baseURL = process.env.CARACAL_AUTH_URL ?? `http://localhost:${port}`;
  const webOrigin = process.env.CARACAL_WEB_ORIGIN ?? "http://localhost:3001";
  const database = resolveDatabase();
  const secret = resolveSecret(database);
  return { port, baseURL, secret, webOrigin, database };
}
