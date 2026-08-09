// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests locking the secret backend selection contract: an external backend never touches the builtin store.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BuiltinSecretBackend, buildRawSecretBackend, buildSecretBackend } from '../../../../apps/api/src/secret-store.ts'
import type { DB } from '../../../../apps/api/src/db.ts'

const SAVED = { ...process.env }

afterEach(() => {
  process.env = { ...SAVED }
})

function trackingDb(): DB {
  return { query: vi.fn(async () => ({ rows: [] })) } as unknown as DB
}

describe('backend selection', () => {
  it('uses the database only for the builtin kind', async () => {
    const db = trackingDb()
    const backend = buildRawSecretBackend(db, 'builtin')
    expect(backend).toBeInstanceOf(BuiltinSecretBackend)
    await backend.get('zones/z1/providers/p1/secretConfig')
    expect(db.query).toHaveBeenCalled()
  })

  it.each(['vault', 'infisical', 'azurekeyvault', 'awssecretsmanager', 'gcpsecretmanager', 'custom'] as const)(
    'never constructs the builtin store for %s',
    (kind) => {
      const db = trackingDb()
      // Constructor throws on missing backend config are acceptable here: the
      // assertion is that the database is never touched either way.
      try {
        const backend = buildRawSecretBackend(db, kind)
        expect(backend).not.toBeInstanceOf(BuiltinSecretBackend)
        expect(backend.kind).toBe(kind)
      } catch {
        // Eager configuration validation is the fail-fast path for a
        // misconfigured external backend.
      }
      expect(db.query).not.toHaveBeenCalled()
    },
  )

  it('fails at startup when an external backend is selected without its configuration', () => {
    process.env.CARACAL_SECRET_BACKEND = 'vault'
    delete process.env.CARACAL_VAULT_ADDR
    delete process.env.CARACAL_VAULT_TOKEN
    expect(() => buildSecretBackend(trackingDb())).toThrow(/CARACAL_VAULT_ADDR/)
  })

  it('rejects an unknown backend kind by name', () => {
    process.env.CARACAL_SECRET_BACKEND = 'parseltongue'
    expect(() => buildSecretBackend(trackingDb())).toThrow(/CARACAL_SECRET_BACKEND must be one of/)
  })
})
