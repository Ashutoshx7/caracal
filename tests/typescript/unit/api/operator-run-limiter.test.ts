// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis-backed Operator run concurrency lease tests.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RedisClient } from '../../../../apps/api/src/redis.js'
import { createOperatorRunLimiter } from '../../../../apps/api/src/operator-run-limiter.js'

function redisWithEval(evalFn: ReturnType<typeof vi.fn>): RedisClient {
  return { eval: evalFn } as unknown as RedisClient
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Operator run limiter', () => {
  it('atomically acquires and owner-releases one slot for a hashed zone/user scope', async () => {
    const evalFn = vi.fn().mockResolvedValue(1)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 2, { leaseTtlMs: 1_000, renewIntervalMs: 500 })

    const lease = await limiter.acquire('zone:one', 'actor@example.com')

    expect(lease).not.toBeNull()
    expect(lease!.signal.aborted).toBe(false)
    expect(evalFn).toHaveBeenCalledTimes(1)
    const acquire = evalFn.mock.calls[0]
    expect(String(acquire[0])).toContain("redis.call('ZREMRANGEBYSCORE'")
    expect(acquire.slice(1, 5)).toEqual([1, expect.stringMatching(/^api:operator-run-slots:v1:[a-f0-9]{64}$/), 2, 1_000])
    expect(String(acquire[1])).not.toContain('zone:one')
    expect(String(acquire[1])).not.toContain('actor@example.com')

    await lease!.release()
    expect(evalFn).toHaveBeenCalledTimes(2)
    expect(String(evalFn.mock.calls[1][0])).toContain("redis.call('ZREM'")
    expect(evalFn.mock.calls[1][2]).toBe(acquire[2])
    expect(evalFn.mock.calls[1][3]).toBe(acquire[5])
  })

  it('returns null without starting a lease when the atomic limit check refuses', async () => {
    vi.useFakeTimers()
    const evalFn = vi.fn().mockResolvedValue(0)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 1, { leaseTtlMs: 100, renewIntervalMs: 25 })

    await expect(limiter.acquire('z1', 'actor-1')).resolves.toBeNull()
    await vi.advanceTimersByTimeAsync(100)
    expect(evalFn).toHaveBeenCalledTimes(1)
  })

  it('renews an acquired lease and stops renewing after an idempotent release', async () => {
    vi.useFakeTimers()
    const evalFn = vi.fn().mockResolvedValue(1)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 3, { leaseTtlMs: 100, renewIntervalMs: 25 })
    const lease = await limiter.acquire('z1', 'actor-1')

    await vi.advanceTimersByTimeAsync(25)
    expect(evalFn).toHaveBeenCalledTimes(2)
    expect(String(evalFn.mock.calls[1][0])).toContain("redis.call('ZSCORE'")

    await lease!.release()
    await lease!.release()
    await vi.advanceTimersByTimeAsync(100)
    expect(evalFn).toHaveBeenCalledTimes(3)
  })

  it('aborts the lease when Redis reports that renewal ownership was lost', async () => {
    vi.useFakeTimers()
    const onRenewError = vi.fn()
    const evalFn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValue(1)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 1, {
      leaseTtlMs: 100,
      renewIntervalMs: 25,
      onRenewError,
    })
    const lease = await limiter.acquire('z1', 'actor-1')

    await vi.advanceTimersByTimeAsync(25)

    expect(lease!.signal.aborted).toBe(true)
    expect(lease!.signal.reason).toEqual(expect.objectContaining({ message: 'Operator run lease ownership was lost' }))
    expect(onRenewError).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(evalFn).toHaveBeenCalledTimes(2)

    await lease!.release()
    expect(evalFn).toHaveBeenCalledTimes(3)
  })

  it('aborts the lease when renewal cannot confirm ownership', async () => {
    vi.useFakeTimers()
    const renewalError = new Error('redis unavailable')
    const onRenewError = vi.fn()
    const evalFn = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(renewalError).mockResolvedValue(1)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 1, {
      leaseTtlMs: 100,
      renewIntervalMs: 25,
      onRenewError,
    })
    const lease = await limiter.acquire('z1', 'actor-1')

    await vi.advanceTimersByTimeAsync(25)

    expect(lease!.signal.aborted).toBe(true)
    expect(lease!.signal.reason).toBe(renewalError)
    expect(onRenewError).toHaveBeenCalledWith(renewalError)
    await vi.advanceTimersByTimeAsync(100)
    expect(evalFn).toHaveBeenCalledTimes(2)

    await lease!.release()
  })

  it('isolates different users and zones while sharing the same composite scope', async () => {
    const evalFn = vi.fn().mockResolvedValue(1)
    const limiter = createOperatorRunLimiter(redisWithEval(evalFn), 2, { leaseTtlMs: 1_000, renewIntervalMs: 500 })
    const leases = await Promise.all([
      limiter.acquire('z1', 'actor-1'),
      limiter.acquire('z1', 'actor-1'),
      limiter.acquire('z1', 'actor-2'),
      limiter.acquire('z2', 'actor-1'),
    ])

    const keys = evalFn.mock.calls.map((call) => call[2])
    expect(keys[0]).toBe(keys[1])
    expect(new Set(keys).size).toBe(3)
    await Promise.all(leases.map((lease) => lease!.release()))
  })

  it('validates the limit and crash-lease timing at construction', () => {
    const redis = redisWithEval(vi.fn())
    expect(() => createOperatorRunLimiter(redis, 0)).toThrow('positive integer')
    expect(() => createOperatorRunLimiter(redis, 1.5)).toThrow('positive integer')
    expect(() => createOperatorRunLimiter(redis, 1, { leaseTtlMs: 10, renewIntervalMs: 10 })).toThrow('below its TTL')
  })
})
