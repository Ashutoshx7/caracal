// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for the API service env-file discovery chain.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CONFIG_PATH = '../../../../apps/api/src/config.ts'

let dir: string
let originalCwd: string
const SAVED_KEYS = ['CARACAL_ENV_FILE', 'CARACAL_REPO_ROOT', 'API_TEST_VAR', 'DATABASE_URL', 'REDIS_URL', 'TRUST_PROXY']

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'caracal-api-cfg-'))
  originalCwd = process.cwd()
  process.chdir(dir)
  for (const k of SAVED_KEYS) delete process.env[k]
  vi.resetModules()
})

afterEach(() => {
  process.chdir(originalCwd)
  rmSync(dir, { recursive: true, force: true })
  for (const k of SAVED_KEYS) delete process.env[k]
})

describe('api config loadEnvChain', () => {
  test('does not load cwd .env in production-like mode', async () => {
    writeFileSync(join(dir, '.env'), 'API_TEST_VAR=cwd-leak\n')
    await import(CONFIG_PATH)
    expect(process.env.API_TEST_VAR).toBeUndefined()
  })

  test('loads CARACAL_ENV_FILE when explicit', async () => {
    const envPath = join(dir, 'explicit.env')
    writeFileSync(envPath, 'API_TEST_VAR=explicit-value\n')
    process.env.CARACAL_ENV_FILE = envPath
    await import(CONFIG_PATH)
    expect(process.env.API_TEST_VAR).toBe('explicit-value')
  })

  test('loads infra/docker/.env when CARACAL_REPO_ROOT is set', async () => {
    mkdirSync(join(dir, 'infra', 'docker'), { recursive: true })
    writeFileSync(join(dir, 'infra', 'docker', '.env'), 'API_TEST_VAR=repo-value\n')
    process.env.CARACAL_REPO_ROOT = dir
    await import(CONFIG_PATH)
    expect(process.env.API_TEST_VAR).toBe('repo-value')
  })

  test('does not walk up from cwd looking for infra/docker/.env', async () => {
    const sub = join(dir, 'a', 'b')
    mkdirSync(sub, { recursive: true })
    mkdirSync(join(dir, 'infra', 'docker'), { recursive: true })
    writeFileSync(join(dir, 'infra', 'docker', '.env'), 'API_TEST_VAR=walked-up\n')
    process.chdir(sub)
    await import(CONFIG_PATH)
    expect(process.env.API_TEST_VAR).toBeUndefined()
  })
})

describe('api config trustProxy', () => {
  const REQ = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/d',
    REDIS_URL: 'redis://:r@localhost:6379',
  }
  beforeEach(() => { for (const [k, v] of Object.entries(REQ)) process.env[k] = v })
  afterEach(() => { for (const k of Object.keys(REQ)) delete process.env[k] })

  test('defaults to false when TRUST_PROXY unset', async () => {
    const { loadConfig } = await import(CONFIG_PATH) as typeof import('../../../../apps/api/src/config')
    expect(loadConfig().trustProxy).toBe(false)
  })

  test('parses TRUST_PROXY=true', async () => {
    process.env.TRUST_PROXY = 'true'
    const { loadConfig } = await import(CONFIG_PATH) as typeof import('../../../../apps/api/src/config')
    expect(loadConfig().trustProxy).toBe(true)
  })
})
