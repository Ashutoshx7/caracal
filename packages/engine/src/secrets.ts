// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Single-source-of-truth credential bootstrap for dev and runtime stacks.

import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ENV_EXAMPLE } from './embedded.js'

const isPosix = process.platform !== 'win32'

export interface SecretFile {
  envKey: string
  fileName: string
  bytes: number
}

export const SECRET_FILES: readonly SecretFile[] = [
  { envKey: 'POSTGRES_PASSWORD', fileName: 'postgresPassword', bytes: 24 },
  { envKey: 'REDIS_PASSWORD', fileName: 'redisPassword', bytes: 24 },
  { envKey: 'CARACAL_ADMIN_TOKEN', fileName: 'caracalAdminToken', bytes: 32 },
  { envKey: 'ZONE_KEK', fileName: 'zoneKek', bytes: 32 },
  { envKey: 'AUDIT_HMAC_KEY', fileName: 'auditHmacKey', bytes: 32 },
  { envKey: 'STREAMS_HMAC_KEY', fileName: 'streamsHmacKey', bytes: 32 },
] as const

export interface BootstrapPaths {
  envFile: string
  envTemplate: string
  secretsDir: string
}

export interface BootstrapReport {
  envCreated: boolean
  envUpdated: boolean
  filesCreated: string[]
}

function chmodSafe(path: string, mode: number): void {
  if (!isPosix) return
  try {
    chmodSync(path, mode)
  } catch {
    // permissions may be unsupported on some filesystems
  }
}

function readOrCreateSecretFile(path: string, bytes: number): { value: string; created: boolean } {
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing.length > 0) {
      chmodSafe(path, 0o444)
      return { value: existing, created: false }
    }
  }
  const value = randomBytes(bytes).toString('hex')
  writeFileSync(path, value, { mode: 0o444 })
  chmodSafe(path, 0o444)
  return { value, created: true }
}

function ensureEnvFile(envFile: string, template: string): boolean {
  if (existsSync(envFile)) return false
  mkdirSync(dirname(envFile), { recursive: true })
  writeFileSync(envFile, template, { mode: 0o600 })
  return true
}

function syncEnv(envFile: string, values: Record<string, string>): boolean {
  const lines = readFileSync(envFile, 'utf8').split('\n')
  let mutated = false
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^${key}=(.*)$`)
    let found = false
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re)
      if (!m) continue
      found = true
      if (m[1] !== value) {
        lines[i] = `${key}=${value}`
        mutated = true
      }
      break
    }
    if (!found) {
      lines.push(`${key}=${value}`)
      mutated = true
    }
  }
  if (mutated) writeFileSync(envFile, lines.join('\n'))
  chmodSafe(envFile, 0o600)
  return mutated
}

export function bootstrapSecrets(paths: BootstrapPaths): BootstrapReport {
  mkdirSync(paths.secretsDir, { recursive: true })
  chmodSafe(paths.secretsDir, 0o700)

  const filesCreated: string[] = []
  const values: Record<string, string> = {}
  for (const spec of SECRET_FILES) {
    const filePath = resolve(paths.secretsDir, spec.fileName)
    const { value, created } = readOrCreateSecretFile(filePath, spec.bytes)
    values[spec.envKey] = value
    if (created) filesCreated.push(spec.fileName)
  }

  const envCreated = ensureEnvFile(paths.envFile, paths.envTemplate)
  const envUpdated = syncEnv(paths.envFile, values)
  return { envCreated, envUpdated, filesCreated }
}

export function devBootstrapPaths(repoRoot: string): BootstrapPaths {
  return {
    envFile: resolve(repoRoot, 'infra', 'docker', '.env'),
    envTemplate: readFileSync(resolve(repoRoot, 'infra', 'docker', '.env.example'), 'utf8'),
    secretsDir: resolve(repoRoot, 'infra', 'secrets', 'files'),
  }
}

export function runtimeBootstrapPaths(home: string): BootstrapPaths {
  return {
    envFile: resolve(home, '.env'),
    envTemplate: ENV_EXAMPLE,
    secretsDir: resolve(home, 'secrets'),
  }
}
