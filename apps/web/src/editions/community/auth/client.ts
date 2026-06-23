/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file builds the Community Edition Better Auth client.
*/
import { createAuthClient } from "better-auth/react";

import { config } from "@/platform/config";

export const authClient = createAuthClient({
  baseURL: config.authBaseUrl,
  fetchOptions: { credentials: "include" },
});
