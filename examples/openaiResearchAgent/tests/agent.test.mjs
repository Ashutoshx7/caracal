// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Integration tests proving runtime-only, scoped, short-lived OpenAI key injection via caracal run.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMockProvider } from '../_mock/server.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..', '..')
const AGENT = join(__dirname, '..', 'agent.mjs')

const [BIN_CMD, ...BIN_PREFIX] = process.env.CARACAL_BIN
  ? [process.env.CARACAL_BIN]
  : [process.execPath, join(REPO_ROOT, 'apps', 'runtime', 'bin', 'caracal.mjs')]

const BASE_ENV = Object.fromEntries(
  ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'TERM',
   'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME']
    .filter((k) => process.env[k] !== undefined)
    .map((k) => [k, process.env[k]])
)

/**
 * Run `caracal run <args>` as a subprocess.
 *
 * @param {string[]} args Arguments after `run`
 * @param {Record<string, string>} env Environment for the subprocess
 */
function run(args, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn(BIN_CMD, [...BIN_PREFIX, 'run', ...args], {
      env: { ...BASE_ENV, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => { stdout += chunk })
    proc.stderr.on('data', (chunk) => { stderr += chunk })
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

let mock
before(async () => { mock = await startMockProvider({ ttlSeconds: 120 }) })
after(() => mock.close())

/**
 * Launch env that points run at the mock STS and the agent at the mock provider.
 *
 * @param {string} resource Resource URI to exchange for OPENAI_API_KEY
 */
function launchEnv(resource = 'resource://openai') {
  return {
    CARACAL_STS_URL: mock.url,
    CARACAL_ZONE_ID: 'test-zone',
    CARACAL_APPLICATION_ID: 'research-agent',
    CARACAL_APP_CLIENT_SECRET: 'test-secret',
    NODE_ENV: 'development',
    CARACAL_RUN_ALLOW_WORKSPACE_SECRETS: 'true',
    CARACAL_RUN_CREDENTIALS: JSON.stringify([{ env: 'OPENAI_API_KEY', resource }]),
  }
}

// caracal run forwards a strict env allowlist, so the agent receives non-secret
// config (base URL, model) as argv flags rather than environment variables.
function agentArgs(task) {
  return ['--', process.execPath, AGENT, `--base-url=${mock.url}/v1`, '--model=gpt-4o-mini', task]
}

describe('runtime-only key injection', () => {
  it('completes a real agent workflow with a token that only lives in the child env', async () => {
    const { code, stdout, stderr } = await run(
      agentArgs('Summarize short-lived credential benefits'),
      launchEnv(),
    )
    assert.equal(code, 0, stderr)
    const result = JSON.parse(stdout.trim())
    assert.match(result.task, /short-lived/)
    assert.match(result.plan, /^ack:/)
    assert.match(result.answer, /^ack:/)
    assert.ok(mock.mintedCount() >= 1, 'a scoped token must have been minted')
  })

  it('scrubs Caracal admin secrets from the agent environment', async () => {
    const { code, stdout } = await run(
      ['--', process.execPath, '-e',
       'process.stdout.write(JSON.stringify({hasKey: !!process.env.OPENAI_API_KEY, admin: process.env.CARACAL_ADMIN_TOKEN ?? null, secret: process.env.CARACAL_APP_CLIENT_SECRET ?? null}))'],
      { ...launchEnv(), CARACAL_ADMIN_TOKEN: 'must-not-reach-child' },
    )
    assert.equal(code, 0)
    const seen = JSON.parse(stdout.trim())
    assert.equal(seen.hasKey, true, 'OPENAI_API_KEY must be injected')
    assert.equal(seen.admin, null, 'CARACAL_ADMIN_TOKEN must be scrubbed')
    assert.equal(seen.secret, null, 'CARACAL_APP_CLIENT_SECRET must be scrubbed')
  })

  it('does not forward arbitrary non-secret env vars to the agent', async () => {
    const { code, stdout } = await run(
      ['--', process.execPath, '-e',
       'process.stdout.write(JSON.stringify({baseUrl: process.env.OPENAI_BASE_URL ?? null, hasKey: !!process.env.OPENAI_API_KEY}))'],
      { ...launchEnv(), OPENAI_BASE_URL: `${mock.url}/v1` },
    )
    assert.equal(code, 0)
    const seen = JSON.parse(stdout.trim())
    assert.equal(seen.hasKey, true, 'OPENAI_API_KEY must be injected')
    assert.equal(seen.baseUrl, null, 'OPENAI_BASE_URL must not be inherited')
  })

  it('injects a Caracal-minted scoped token, not a raw provider key', async () => {
    const { code, stdout } = await run(
      ['--', process.execPath, '-e',
       'process.stdout.write(process.env.OPENAI_API_KEY ?? "")'],
      launchEnv(),
    )
    assert.equal(code, 0)
    assert.match(stdout.trim(), /^sk-caracal-/, 'token must be the scoped credential minted by the STS')
  })
})

describe('scoped access', () => {
  it('a request for an out-of-scope resource is denied and the agent never starts', async () => {
    const { code, stderr } = await run(
      agentArgs('should not run'),
      launchEnv('resource://billing'),
    )
    assert.equal(code, 1)
    assert.match(stderr, /resource:\/\/billing/)
  })
})

describe('short-lived usage', () => {
  it('the provider rejects a minted token once it has expired', async () => {
    const tokenRes = await fetch(`${mock.url}/oauth/2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ resource: 'resource://openai' }).toString(),
    })
    const { access_token } = await tokenRes.json()

    const ok = await fetch(`${mock.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    })
    assert.equal(ok.status, 200, 'a fresh token must be accepted')

    mock.expireAll()

    const expired = await fetch(`${mock.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    })
    assert.equal(expired.status, 401, 'an expired token must be rejected')
  })

  it('a leaked but unminted bearer is rejected by the provider', async () => {
    const res = await fetch(`${mock.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer sk-caracal-deadbeef', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    })
    assert.equal(res.status, 401)
  })
})

describe('no persistent secret storage', () => {
  it('the agent refuses to run when no key is injected (no .env fallback)', async () => {
    const { code, stderr } = await new Promise((resolve) => {
      const proc = spawn(process.execPath, [AGENT, 'task'], {
        env: { ...BASE_ENV, OPENAI_BASE_URL: `${mock.url}/v1` },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (c) => { stdout += c })
      proc.stderr.on('data', (c) => { stderr += c })
      proc.on('close', (c) => resolve({ code: c ?? 1, stdout, stderr }))
    })
    assert.equal(code, 2)
    assert.match(stderr, /OPENAI_API_KEY is not set/)
  })
})
