// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Workspace test runner tests cover portable child process arguments.

import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnSyncMock = vi.hoisted(() => vi.fn(() => ({ status: 0 })))
const platform = process.platform
const argv = [...process.argv]
const root = resolve(import.meta.dirname, '../../../..')
const suiteDir = join(root, 'packages/my engine')

vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }))
vi.mock('node:fs', () => ({
  existsSync: () => true,
  readdirSync: () => [],
  readFileSync: (path: string) =>
    String(path).endsWith('pnpm-workspace.yaml')
      ? "packages:\n  - 'packages/my engine'\n"
      : '{"name":"@caracalai/engine","scripts":{"test":"vitest"}}',
}))

describe('workspace test runner', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset()
    spawnSyncMock.mockReturnValue({ status: 0 })
    vi.resetModules()
    process.argv = [argv[0], 'runTsTests.mjs', '--coverage']
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true })
    process.argv = [...argv]
    vi.restoreAllMocks()
  })

  it('quotes arguments containing spaces for the Windows shell', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    await import('../../../../scripts/runTsTests.mjs')

    const [command, args, options] = spawnSyncMock.mock.calls[0]
    expect(command).toBe('pnpm')
    expect(options).toMatchObject({ cwd: root, shell: true })
    expect(args).toContain(`"${suiteDir}"`)
    expect(args.filter((arg: string) => arg.includes(' ') && !arg.startsWith('"'))).toEqual([])
    expect(args).toContain('--coverage.provider=v8')
  })

  it('passes arguments verbatim without a shell elsewhere', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    await import('../../../../scripts/runTsTests.mjs')

    const [, args, options] = spawnSyncMock.mock.calls[0]
    expect(options).toMatchObject({ cwd: root, shell: false })
    expect(args).toContain(suiteDir)
    expect(args.some((arg: string) => arg.startsWith('"'))).toBe(false)
  })
})
