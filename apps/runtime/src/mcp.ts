// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// MCP shadow governance: detects unauthorized MCP server processes and blocks or logs.

import type { RuntimeConfig } from './config.ts'
import { checkMcpGovernance as checkSharedMcpGovernance } from '@caracalai/engine'

export function checkMcpGovernance(args: string[] | string, cfg: RuntimeConfig): void {
  try {
    checkSharedMcpGovernance(args, cfg, (line) => process.stderr.write(line + '\n'))
  } catch {
    process.exit(1)
  }
}
