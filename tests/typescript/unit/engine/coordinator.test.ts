// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Engine Coordinator helpers use file-backed operator token discovery.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { ensureCoordinatorToken } from '../../../../packages/engine/src/coordinator.ts'

describe('ensureCoordinatorToken', () => {
  const saved = { ...process.env }
  let dir: string

  afterEach(() => {
    process.env = { ...saved }
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('accepts a file-backed coordinator token', () => {
    dir = mkdtempSync(join(tmpdir(), 'caracal-coordinator-'))
    const tokenFile = join(dir, 'token')
    writeFileSync(tokenFile, 'coordinator-secret\n')
    process.env = { ...saved, CARACAL_COORDINATOR_TOKEN_FILE: tokenFile }
    delete process.env.CARACAL_COORDINATOR_TOKEN

    expect(() => ensureCoordinatorToken()).not.toThrow()
  })
})
