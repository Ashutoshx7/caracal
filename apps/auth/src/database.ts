// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Database handle for the Community Edition authentication service: PostgreSQL in
// production, local SQLite for development.

import type { BetterAuthOptions } from "better-auth";
import { silenceSqliteExperimentalWarning } from "@caracalai/core";

import { loadConfig } from "./config.ts";

const cfg = loadConfig();

export type AuthDatabaseKind = "postgres" | "sqlite";

interface AuthDatabase {
  kind: AuthDatabaseKind;
  // Better Auth detects the dialect from the handle: a pg.Pool (postgres) or a node:sqlite
  // DatabaseSync (sqlite). Both satisfy the database option's structural contract.
  handle: BetterAuthOptions["database"];
  close: () => Promise<void>;
}

async function createPostgres(url: string, ssl: "disable" | "require" | "no-verify"): Promise<AuthDatabase> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: ssl === "disable" ? undefined : { rejectUnauthorized: ssl === "require" },
  });
  return {
    kind: "postgres",
    handle: pool as unknown as BetterAuthOptions["database"],
    close: () => pool.end(),
  };
}

async function createSqlite(path: string): Promise<AuthDatabase> {
  // node:sqlite emits its experimental warning when first loaded, so install the targeted
  // filter before importing it. The dynamic import enforces that ordering.
  silenceSqliteExperimentalWarning();
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path);
  return {
    kind: "sqlite",
    handle: db as unknown as BetterAuthOptions["database"],
    close: async () => db.close(),
  };
}

const database =
  cfg.database.kind === "postgres"
    ? await createPostgres(cfg.database.url, cfg.database.ssl)
    : await createSqlite(cfg.database.path);

export const authDatabase = database.handle;
export const authDatabaseKind = database.kind;
export const closeAuthDatabase = database.close;
