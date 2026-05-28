// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal run <cmd...>`: injects ambient 60-min tokens into child process env.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverRepoRoot } from '@caracalai/core'
import { buildRunEnv, runExec } from '@caracalai/engine'
import type { RuntimeConfig } from '../config.ts'
import { printError } from '../style.ts'

function assertNoWorkspaceOperatorSecrets(): void {
  if (process.env.CARACAL_RUN_ALLOW_WORKSPACE_SECRETS === 'true') return
  const root = discoverRepoRoot()
  if (!root) return
  const legacy = join(root, 'infra', 'secrets', 'files', 'caracalAdminToken')
  if (!existsSync(legacy)) return
  throw new Error(
    'refusing to run workload while legacy workspace operator secrets are present; remove infra/secrets/files or set CARACAL_RUN_ALLOW_WORKSPACE_SECRETS=true for trusted local development',
  )
}

export async function runCommand(argv: string[], cfg: RuntimeConfig): Promise<void> {
  const commandArgs = argv[0] === '--' ? argv.slice(1) : argv
  if (commandArgs.length === 0) {
    printError('Usage: caracal run <cmd...>')
    process.exit(1)
  }

  let env: Record<string, string>
  try {
    assertNoWorkspaceOperatorSecrets()
    env = await buildRunEnv(cfg, {
      onLine: (line, stream) => {
        const target = stream === 'stderr' ? process.stderr : process.stdout
        target.write(line + '\n')
      },
    })
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  const handle = runExec({ argv: commandArgs, env, forwardSignals: false })
  const code = await handle.exitCode
  process.exit(code)
}
