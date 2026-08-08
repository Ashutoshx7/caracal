// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the standalone installer scripts in environments without a user context.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const installScript = join(repoRoot, 'install.sh')

// cloud-init, systemd, and container runtimes invoke the installer with no
// inherited environment, which is what an empty env reproduces here.
function runInstaller(env: NodeJS.ProcessEnv, ...args: string[]) {
  const result = spawnSync('/bin/sh', [installScript, ...args], { env, encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe.skipIf(process.platform === 'win32')('install.sh environment handling', () => {
  let stageDir: string

  beforeAll(() => {
    stageDir = mkdtempSync(join(tmpdir(), 'caracalInstall'))
  })

  afterAll(() => {
    rmSync(stageDir, { recursive: true, force: true })
  })

  it('parses without syntax errors', () => {
    expect(spawnSync('/bin/sh', ['-n', installScript]).status).toBe(0)
  })

  it('falls back to the system prefix when HOME is absent', () => {
    const { status, output } = runInstaller({}, '--uninstall', '--destdir', stageDir)
    expect(status).toBe(0)
    expect(output).toContain(join(stageDir, 'usr/local/bin'))
  })

  it('keeps the user prefix when HOME is present', () => {
    const { status, output } = runInstaller({ HOME: '/tmp/caracalHome' }, '--uninstall', '--destdir', stageDir)
    expect(status).toBe(0)
    expect(output).toContain(join(stageDir, '/tmp/caracalHome/.local/bin'))
  })

  it('lets an explicit install directory win without HOME', () => {
    const env = { CARACAL_INSTALL_DIR: '/opt/custom/bin' }
    const { status, output } = runInstaller(env, '--uninstall', '--destdir', stageDir)
    expect(status).toBe(0)
    expect(output).toContain(join(stageDir, '/opt/custom/bin'))
  })

  it('prints help with no environment at all', () => {
    const { status, output } = runInstaller({}, '--help')
    expect(status).toBe(0)
    expect(output).toContain('default: /usr/local')
  })

  it('reports the resolved default prefix in help', () => {
    const { output } = runInstaller({ HOME: '/tmp/caracalHome' }, '--help')
    expect(output).toContain('default: /tmp/caracalHome/.local')
  })

  it.each([
    ['help', ['--help']],
    ['uninstall', ['--uninstall']],
  ])('never reports an unset variable during %s', (_name, args) => {
    const { output } = runInstaller({}, ...args, '--destdir', stageDir)
    expect(output).not.toMatch(/unbound variable|parameter not set/)
  })
})
