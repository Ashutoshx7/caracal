// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Cross-replica concurrency guard for Operator model runs.

import { createHash, randomUUID } from 'node:crypto'
import type { RedisClient } from './redis.js'

// A lease is renewed while its request is alive and released explicitly when the run settles.
// The TTL is only a crash backstop: if an API process dies, Redis eventually makes the slot
// available without requiring an operator to repair state.
const DEFAULT_LEASE_TTL_MS = 150_000
const DEFAULT_RENEW_INTERVAL_MS = 30_000

const ACQUIRE_SCRIPT = `
local now_parts = redis.call('TIME')
local now_ms = (tonumber(now_parts[1]) * 1000) + math.floor(tonumber(now_parts[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 0
end
redis.call('ZADD', KEYS[1], now_ms + tonumber(ARGV[2]), ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

const RENEW_SCRIPT = `
if not redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 0 end
local now_parts = redis.call('TIME')
local now_ms = (tonumber(now_parts[1]) * 1000) + math.floor(tonumber(now_parts[2]) / 1000)
redis.call('ZADD', KEYS[1], now_ms + tonumber(ARGV[2]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

const RELEASE_SCRIPT = `
local removed = redis.call('ZREM', KEYS[1], ARGV[1])
if redis.call('ZCARD', KEYS[1]) == 0 then redis.call('DEL', KEYS[1]) end
return removed
`

export interface OperatorRunLease {
  release(): Promise<void>
}

export interface OperatorRunLimiter {
  readonly maxConcurrentRuns: number
  acquire(zoneId: string, actorId: string): Promise<OperatorRunLease | null>
}

export interface OperatorRunLimiterOptions {
  leaseTtlMs?: number
  renewIntervalMs?: number
  onRenewError?: (error: unknown) => void
}

function scopeKey(zoneId: string, actorId: string): string {
  // Hash the composite identity so user-controlled identifiers cannot alter the Redis key
  // namespace and do not remain readable in operational key listings.
  const scope = createHash('sha256').update(zoneId).update('\0').update(actorId).digest('hex')
  return `api:operator-run-slots:v1:${scope}`
}

export function createOperatorRunLimiter(
  redis: RedisClient,
  maxConcurrentRuns: number,
  options: OperatorRunLimiterOptions = {},
): OperatorRunLimiter {
  if (!Number.isSafeInteger(maxConcurrentRuns) || maxConcurrentRuns < 1) {
    throw new Error('Operator concurrent run limit must be a positive integer')
  }
  const leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS
  const renewIntervalMs = options.renewIntervalMs ?? DEFAULT_RENEW_INTERVAL_MS
  if (!Number.isSafeInteger(leaseTtlMs) || leaseTtlMs < 1) throw new Error('Operator run lease TTL must be a positive integer')
  if (!Number.isSafeInteger(renewIntervalMs) || renewIntervalMs < 1 || renewIntervalMs >= leaseTtlMs) {
    throw new Error('Operator run lease renewal interval must be a positive integer below its TTL')
  }

  return {
    maxConcurrentRuns,
    async acquire(zoneId: string, actorId: string): Promise<OperatorRunLease | null> {
      const key = scopeKey(zoneId, actorId)
      const owner = randomUUID()
      const acquired = await redis.eval(ACQUIRE_SCRIPT, 1, key, maxConcurrentRuns, leaseTtlMs, owner)
      if (Number(acquired) !== 1) return null

      let released = false
      let renewing = false
      const renew = async () => {
        if (released || renewing) return
        renewing = true
        try {
          await redis.eval(RENEW_SCRIPT, 1, key, owner, leaseTtlMs)
        } catch (error) {
          options.onRenewError?.(error)
        } finally {
          renewing = false
        }
      }
      const timer = setInterval(() => void renew(), renewIntervalMs)
      timer.unref()

      return {
        async release(): Promise<void> {
          if (released) return
          released = true
          clearInterval(timer)
          await redis.eval(RELEASE_SCRIPT, 1, key, owner)
        },
      }
    },
  }
}
