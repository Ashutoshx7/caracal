// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator-token guard for agent and delegation commands.

export function ensureCoordinatorToken(): void {
  if (!process.env.CARACAL_COORDINATOR_TOKEN) {
    throw new Error(
      'CARACAL_COORDINATOR_TOKEN required (JWT issued by STS with scope "agent:lifecycle"); set it before invoking agent/delegation commands.',
    )
  }
}
