// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TokenCache interface and bounded in-memory default keyed by hashed subject+resource.

import { createHash } from 'node:crypto'
import type { TokenExchangeResponse } from './types.js'

export interface TokenCache {
  get(subjectToken: string, resource: string): TokenExchangeResponse | undefined
  set(subjectToken: string, resource: string, token: TokenExchangeResponse): void
}

export interface InMemoryTokenCacheOptions {
  maxEntries?: number
}

const DEFAULT_MAX_ENTRIES = 10_000

export class InMemoryTokenCache implements TokenCache {
  private readonly map = new Map<string, { token: TokenExchangeResponse; expiresAt: number }>()
  private readonly maxEntries: number

  constructor(opts: InMemoryTokenCacheOptions = {}) {
    const cap = opts.maxEntries ?? DEFAULT_MAX_ENTRIES
    if (!Number.isInteger(cap) || cap <= 0) {
      throw new Error('InMemoryTokenCache.maxEntries must be a positive integer')
    }
    this.maxEntries = cap
  }

  get(subjectToken: string, resource: string): TokenExchangeResponse | undefined {
    const key = cacheKey(subjectToken, resource)
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() / 1000 >= entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.token
  }

  set(subjectToken: string, resource: string, token: TokenExchangeResponse): void {
    const key = cacheKey(subjectToken, resource)
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, {
      token,
      expiresAt: token.issuedAt + token.expiresIn,
    })
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }
}

function cacheKey(subjectToken: string, resource: string): string {
  return createHash('sha256').update(subjectToken).update('\0').update(resource).digest('hex')
}
