// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Resolves StackPaths for dev and runtime modes, installing and seeding assets as needed.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { installRuntimeAssets, runtimePaths, seedEnvFile } from './runtime.js'
import type { StackPaths } from './stack.js'

export type StackMode = 'dev' | 'runtime'

export interface ResolveStackPathsOptions {
  mode?: StackMode
  repoRoot?: string
  onInfo?: (message: string) => void
}

export function resolveStackPaths(opts: ResolveStackPathsOptions = {}): StackPaths {
  const mode = opts.mode ?? defaultMode()
  if (mode === 'dev') return devPaths(opts)
  return runtimeStackPaths(opts)
}

function defaultMode(): StackMode {
  const override = process.env.CARACAL_MODE
  if (override === 'dev' || override === 'runtime') return override
  if (override) {
    throw new Error(`CARACAL_MODE must be 'dev' or 'runtime' (got '${override}')`)
  }
  return process.env.CARACAL_REPO_ROOT ? 'dev' : 'runtime'
}

function devPaths(opts: ResolveStackPathsOptions): StackPaths {
  const repoRoot = opts.repoRoot ?? process.env.CARACAL_REPO_ROOT
  if (!repoRoot) {
    throw new Error(
      "CARACAL_MODE=dev requires CARACAL_REPO_ROOT; invoke via 'pnpm caracal' from inside the repo.",
    )
  }
  const composeFile = process.env.CARACAL_COMPOSE_FILE ?? join(repoRoot, 'infra', 'docker', 'docker-compose.yml')
  const envFile = process.env.CARACAL_ENV_FILE ?? join(repoRoot, 'infra', 'docker', '.env')
  if (!existsSync(envFile)) {
    throw new Error(`env file not found at ${envFile}; copy infra/docker/.env.example to infra/docker/.env first.`)
  }
  const { seeded } = seedEnvFile(envFile)
  if (seeded) opts.onInfo?.(`seeded missing secrets in ${envFile}`)
  return { composeFile, envFile, cwd: repoRoot, mode: 'dev' }
}

function runtimeStackPaths(opts: ResolveStackPathsOptions): StackPaths {
  const paths = runtimePaths()
  const { created } = installRuntimeAssets(paths)
  if (created) opts.onInfo?.(`provisioned runtime assets at ${paths.home}`)
  const composeFile = process.env.CARACAL_COMPOSE_FILE ?? paths.composeFile
  const envFile = process.env.CARACAL_ENV_FILE ?? paths.envFile
  const { seeded } = seedEnvFile(envFile)
  if (seeded) opts.onInfo?.(`seeded missing secrets in ${envFile}`)
  return { composeFile, envFile, cwd: paths.home, mode: 'runtime' }
}
