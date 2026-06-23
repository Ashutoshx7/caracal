// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// SQLite database handle owned by the Community Edition authentication service.

import { DatabaseSync } from "node:sqlite";

import { loadConfig } from "./config.ts";

export const authDatabase = new DatabaseSync(loadConfig().databasePath);
