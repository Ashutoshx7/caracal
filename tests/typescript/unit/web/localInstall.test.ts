// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for browser-local identity reconciliation against the backend account.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

class LocalStorageStub {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const INSTALL_KEY = 'caracal.install'
const PROFILE_KEY = 'caracal.profile'
const OWNER_KEY = 'caracal.owner'

let mod: typeof import('../../../../apps/web/src/platform/state/localInstall.ts')

beforeEach(async () => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new LocalStorageStub()
  mod = await import('../../../../apps/web/src/platform/state/localInstall.ts')
})

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
})

describe('reconcileLocalIdentity', () => {
  it('clears a cached profile when the backend reports no account (purge)', () => {
    localStorage.setItem(INSTALL_KEY, JSON.stringify({ name: 'Prod', onboarded: true }))
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ accountId: 'CRC-1', fullName: 'Op' }))
    localStorage.setItem(OWNER_KEY, JSON.stringify('user-1'))

    mod.reconcileLocalIdentity(null)

    expect(localStorage.getItem(INSTALL_KEY)).toBeNull()
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull()
    expect(localStorage.getItem(OWNER_KEY)).toBeNull()
    expect(mod.isOnboarded()).toBe(false)
  })

  it('clears legacy cached identity that predates account binding', () => {
    localStorage.setItem(INSTALL_KEY, JSON.stringify({ name: 'Prod', onboarded: true }))
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ accountId: 'CRC-1', fullName: 'Op' }))

    mod.reconcileLocalIdentity(null)

    expect(localStorage.getItem(INSTALL_KEY)).toBeNull()
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull()
  })

  it('binds the cached identity to the signed-in account on first reconcile', () => {
    mod.reconcileLocalIdentity('user-1')
    expect(JSON.parse(localStorage.getItem(OWNER_KEY) as string)).toBe('user-1')
  })

  it('keeps the cached identity for the same account', () => {
    localStorage.setItem(OWNER_KEY, JSON.stringify('user-1'))
    localStorage.setItem(INSTALL_KEY, JSON.stringify({ name: 'Prod', onboarded: true }))

    mod.reconcileLocalIdentity('user-1')

    expect(localStorage.getItem(INSTALL_KEY)).not.toBeNull()
    expect(mod.isOnboarded()).toBe(true)
  })

  it('resets and rebinds when a different account signs in', () => {
    localStorage.setItem(OWNER_KEY, JSON.stringify('user-1'))
    localStorage.setItem(INSTALL_KEY, JSON.stringify({ name: 'Prod', onboarded: true }))
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ accountId: 'CRC-1', fullName: 'Op' }))

    mod.reconcileLocalIdentity('user-2')

    expect(localStorage.getItem(INSTALL_KEY)).toBeNull()
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(OWNER_KEY) as string)).toBe('user-2')
  })

  it('does nothing when unauthenticated with no cached identity', () => {
    mod.reconcileLocalIdentity(null)
    expect(localStorage.getItem(INSTALL_KEY)).toBeNull()
    expect(localStorage.getItem(OWNER_KEY)).toBeNull()
  })
})

describe('sanitizeHandle', () => {
  it('drops spaces and disallowed characters', () => {
    expect(mod.sanitizeHandle('Ada Lovelace')).toBe('AdaLovelace')
    expect(mod.sanitizeHandle('a@d#a!.b_c-d')).toBe('ada.b_c-d')
  })

  it('caps the handle at the shared maximum', () => {
    expect(mod.sanitizeHandle('x'.repeat(50))).toHaveLength(mod.HANDLE_MAX)
  })
})

describe('resolveDisplayName', () => {
  it('uses an explicit display name when provided', () => {
    expect(mod.resolveDisplayName('Ada Lovelace', 'ada')).toBe('ada')
  })

  it('falls back to the first name when the display name is blank', () => {
    expect(mod.resolveDisplayName('Ada Lovelace', '')).toBe('Ada')
    expect(mod.resolveDisplayName('Ada Lovelace', '   ')).toBe('Ada')
  })

  it('never returns a handle containing a space', () => {
    expect(mod.resolveDisplayName('Mary Jane Watson', '')).toBe('Mary')
  })

  it('returns an empty string when there is no name at all', () => {
    expect(mod.resolveDisplayName('', '')).toBe('')
  })
})
