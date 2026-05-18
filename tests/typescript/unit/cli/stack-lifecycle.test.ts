// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Lifecycle tests for stack startup/shutdown flows and compose command wiring.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runExecMock = vi.hoisted(() => vi.fn())
const isControlEnabledMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../packages/engine/src/run.ts', () => ({
  runExec: runExecMock,
}))

vi.mock('../../../../packages/engine/src/controlState.ts', () => ({
  isControlEnabled: isControlEnabledMock,
}))

import { composeRun, defaultServiceProbes, stackDown, stackUp } from '../../../../packages/engine/src/stack.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'caracal-stack-'))
  runExecMock.mockReset()
  isControlEnabledMock.mockReset()
  isControlEnabledMock.mockReturnValue(false)
  delete process.env.CONTROL_PORT
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('stack lifecycle', () => {
  it('stackUp in dev mode adds --build and prunes exited one-shot containers after success', async () => {
    const envFile = join(dir, 'dev.env')
    writeFileSync(envFile, 'CARACAL_MODE=dev\n')
    runExecMock
      .mockReturnValueOnce({ dispose: () => {}, exitCode: Promise.resolve(0) })
      .mockReturnValueOnce({ dispose: () => {}, exitCode: Promise.resolve(0) })

    const handle = stackUp({
      paths: {
        composeFile: '/tmp/compose.yml',
        envFiles: [envFile],
        cwd: '/tmp/repo',
        mode: 'dev',
      },
      args: ['api'],
      env: { CARACAL_MODE: 'dev' },
    })

    await expect(handle.exitCode).resolves.toBe(0)
    expect(runExecMock).toHaveBeenCalledTimes(2)
    expect(runExecMock.mock.calls[0][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      '/tmp/compose.yml',
      'up',
      '-d',
      '--build',
      '--remove-orphans',
      'api',
    ])
    expect(runExecMock.mock.calls[1][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      '/tmp/compose.yml',
      'rm',
      '-f',
    ])
  })

  it('stackUp in stable mode skips --build and does not prune on failure', async () => {
    const envFile = join(dir, 'caracal.env')
    writeFileSync(envFile, '# operator env\n')
    runExecMock.mockReturnValueOnce({ dispose: () => {}, exitCode: Promise.resolve(42) })

    const handle = stackUp({
      paths: {
        composeFile: '/tmp/compose.yml',
        envFiles: [envFile],
        cwd: '/tmp/home',
        mode: 'stable',
      },
      args: [],
      env: { CARACAL_MODE: 'stable' },
    })

    await expect(handle.exitCode).resolves.toBe(42)
    expect(runExecMock).toHaveBeenCalledTimes(1)
    expect(runExecMock.mock.calls[0][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      '/tmp/compose.yml',
      'up',
      '-d',
      '--remove-orphans',
    ])
  })

  it('stackDown forwards down args and compose env-file layering', async () => {
    const devEnv = join(dir, 'dev.env')
    const localEnv = join(dir, 'local.env')
    writeFileSync(devEnv, 'CARACAL_MODE=dev\n')
    writeFileSync(localEnv, 'LOG_LEVEL=debug\n')
    runExecMock.mockReturnValueOnce({ dispose: () => {}, exitCode: Promise.resolve(0) })

    const handle = stackDown({
      paths: {
        composeFile: '/tmp/compose.yml',
        envFiles: [devEnv, localEnv],
        cwd: '/tmp/repo',
        mode: 'dev',
      },
      args: ['--volumes'],
    })

    await expect(handle.exitCode).resolves.toBe(0)
    expect(runExecMock).toHaveBeenCalledOnce()
    expect(runExecMock.mock.calls[0][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      devEnv,
      '--env-file',
      localEnv,
      '-f',
      '/tmp/compose.yml',
      'down',
      '--volumes',
    ])
  })

  it('composeRun includes control profile only when control is enabled', async () => {
    const envFile = join(dir, 'caracal.env')
    writeFileSync(envFile, '# operator env\n')
    runExecMock.mockReturnValue({ dispose: () => {}, exitCode: Promise.resolve(0) })

    isControlEnabledMock.mockReturnValueOnce(true)
    const withProfile = composeRun({
      paths: {
        composeFile: '/tmp/compose.yml',
        envFiles: [envFile],
        cwd: '/tmp/home',
        mode: 'stable',
      },
      args: ['ps'],
    })
    await withProfile.exitCode

    expect(runExecMock.mock.calls[0][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      '/tmp/compose.yml',
      '--profile',
      'control',
      'ps',
    ])

    isControlEnabledMock.mockReturnValueOnce(false)
    const withoutProfile = composeRun({
      paths: {
        composeFile: '/tmp/compose.yml',
        envFiles: [envFile],
        cwd: '/tmp/home',
        mode: 'stable',
      },
      args: ['ps'],
    })
    await withoutProfile.exitCode

    expect(runExecMock.mock.calls[1][0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      '/tmp/compose.yml',
      'ps',
    ])
  })
})

describe('defaultServiceProbes', () => {
  it('includes control probe with explicit CONTROL_PORT only when control is enabled', () => {
    isControlEnabledMock.mockReturnValueOnce(true)
    process.env.CONTROL_PORT = '9100'
    const enabled = defaultServiceProbes('/tmp/home')
    expect(enabled.some((p) => p.name === 'control' && p.port === 9100)).toBe(true)

    isControlEnabledMock.mockReturnValueOnce(false)
    const disabled = defaultServiceProbes('/tmp/home')
    expect(disabled.some((p) => p.name === 'control')).toBe(false)
  })
})
