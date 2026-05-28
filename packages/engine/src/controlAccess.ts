// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Local authorization guard for human-driven Control API management.

import { timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { installedHome, managedSecretDirs } from '@caracalai/core'

export interface ControlManagementAccessOptions {
  env?: NodeJS.ProcessEnv
  stdinIsTTY?: boolean
  stdoutIsTTY?: boolean
  requireTty?: boolean
}

interface ControlTokenSource {
  token: string
  path: string
}

function readToken(path: string): ControlTokenSource | undefined {
  if (!existsSync(path)) return undefined
  const token = readFileSync(path, 'utf8').trim()
  return token.length > 0 ? { token, path } : undefined
}

function managedTokenSources(env: NodeJS.ProcessEnv): ControlTokenSource[] {
  const sources: ControlTokenSource[] = []
  const preferDev = env.CARACAL_MODE === 'dev' || (env.CARACAL_REPO_ROOT !== undefined && !env.CARACAL_HOME)
  for (const dir of managedSecretDirs({ preferDev })) {
    const token = readToken(join(dir, 'caracalAdminToken'))
    if (token) sources.push(token)
  }
  return sources
}

function configuredToken(env: NodeJS.ProcessEnv, local: ControlTokenSource): string {
  if (env.CARACAL_ADMIN_TOKEN) return env.CARACAL_ADMIN_TOKEN
  if (env.CARACAL_ADMIN_TOKEN_FILE) {
    const token = readToken(env.CARACAL_ADMIN_TOKEN_FILE)
    if (!token) throw new Error(`Control management admin token file is empty or missing: ${env.CARACAL_ADMIN_TOKEN_FILE}`)
    return token.token
  }
  return local.token
}

function tokenMatches(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function authorizeControlManagementAccess(opts: ControlManagementAccessOptions = {}): void {
  const env = opts.env ?? process.env
  const requireTty = opts.requireTty ?? true
  if (requireTty) {
    const stdinIsTTY = opts.stdinIsTTY ?? process.stdin.isTTY === true
    const stdoutIsTTY = opts.stdoutIsTTY ?? process.stdout.isTTY === true
    if (!stdinIsTTY || !stdoutIsTTY) {
      throw new Error('Control management requires an authenticated interactive Console session.')
    }
  }
  const local = managedTokenSources(env)[0]
  if (!local) {
    throw new Error(
      `Control management requires the local managed admin token at ${join(installedHome(), 'secrets', 'caracalAdminToken')} or the configured CARACAL_SECRETS_DIR.`,
    )
  }
  const token = configuredToken(env, local)
  if (!tokenMatches(token, local.token)) {
    throw new Error('Control management admin token does not match the local managed secret.')
  }
}
