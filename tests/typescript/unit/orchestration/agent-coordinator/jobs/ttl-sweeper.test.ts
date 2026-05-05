// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent coordinator TTL sweeper unit tests for termination side effects.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisMocks = vi.hoisted(() => ({
  publishSessionRevocation: vi.fn(),
  publishLifecycle: vi.fn(),
}))

vi.mock('../../../../../../apps/agent-coordinator/src/redis.js', () => redisMocks)

import { runTTLSweep } from '../../../../../../apps/agent-coordinator/src/jobs/ttl-sweeper.js'

describe('runTTLSweep', () => {
  beforeEach(() => {
    redisMocks.publishSessionRevocation.mockReset()
    redisMocks.publishLifecycle.mockReset()
  })

  it('terminates expired agent sessions and publishes revocation events', async () => {
    const db = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          { id: 'agent-1', zone_id: 'zone1', session_sid: 'sid-1' },
          { id: 'agent-2', zone_id: 'zone1', session_sid: 'sid-2' },
        ],
      }),
    }

    const count = await runTTLSweep(db as never)

    expect(count).toBe(2)
    expect(db.query.mock.calls[0][0]).toContain("status = 'active'")
    expect(redisMocks.publishSessionRevocation).toHaveBeenCalledWith('zone1', 'sid-1')
    expect(redisMocks.publishSessionRevocation).toHaveBeenCalledWith('zone1', 'sid-2')
    expect(redisMocks.publishLifecycle).toHaveBeenCalledWith('terminate', 'zone1', 'agent-1', null)
    expect(redisMocks.publishLifecycle).toHaveBeenCalledWith('terminate', 'zone1', 'agent-2', null)
  })

  it('does not publish events when no sessions expire', async () => {
    const db = { query: vi.fn().mockResolvedValueOnce({ rows: [] }) }

    await expect(runTTLSweep(db as never)).resolves.toBe(0)

    expect(redisMocks.publishSessionRevocation).not.toHaveBeenCalled()
    expect(redisMocks.publishLifecycle).not.toHaveBeenCalled()
  })
})