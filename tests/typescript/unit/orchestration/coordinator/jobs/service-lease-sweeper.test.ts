// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Service lease sweeper unit tests covering heartbeat-loss suspension and revocation.

import { describe, expect, it, vi } from 'vitest'
import '../../../../../shared/test-utils/typescript/coordinatorEnv.js'
import { runServiceLeaseSweep } from '../../../../../../apps/coordinator/src/jobs/service-lease-sweeper.js'

interface Step {
  match?: RegExp
  rows?: unknown[]
}

function clientFromSteps(steps: Step[]) {
  const calls: Array<[string, unknown[] | undefined]> = []
  return {
    calls,
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params])
      for (const step of steps) {
        if (step.match && step.match.test(sql)) {
          return { rows: step.rows ?? [] }
        }
      }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
}

describe('runServiceLeaseSweep', () => {
  it('skips work when the advisory lock is held by another node', async () => {
    const client = clientFromSteps([
      { match: /pg_try_advisory_xact_lock/, rows: [{ acquired: false }] },
    ])
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }
    await expect(runServiceLeaseSweep(db as never)).resolves.toBe(0)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('suspends expired service sessions and emits revocation events', async () => {
    const expired = [
      { id: 'agent-1', zone_id: 'z1' },
      { id: 'agent-2', zone_id: 'z1' },
    ]
    const suspended = [
      { id: 'agent-1', subject_session_id: 'sid-1', parent_id: null },
      { id: 'agent-2', subject_session_id: 'sid-2', parent_id: 'agent-1' },
    ]
    const client = clientFromSteps([])
    client.query = vi.fn(async (sql: string, params?: unknown[]) => {
      client.calls.push([sql, params])
      if (/pg_try_advisory_xact_lock/.test(sql)) return { rows: [{ acquired: true }] }
      if (/FROM agent_sessions[\s\S]*heartbeat_deadline_at < now\(\)[\s\S]*FOR UPDATE SKIP LOCKED/.test(sql)) {
        return { rows: expired }
      }
      if (/WITH RECURSIVE tree[\s\S]*FROM suspended/.test(sql)) {
        return { rows: suspended }
      }
      return { rows: [] }
    }) as never

    const db = { connect: vi.fn().mockResolvedValueOnce(client) }
    const count = await runServiceLeaseSweep(db as never)
    expect(count).toBe(2)

    const outboxInserts = client.calls.filter(([sql]) => sql.includes('INSERT INTO caracal_outbox'))
    const allDedupes = outboxInserts.flatMap(([, params]) => (params ?? []) as unknown[])
    expect(allDedupes).toEqual(expect.arrayContaining([
      'suspend:agent-1',
      'suspend:agent-2',
      'agent_suspend:agent-1',
      'agent_suspend:agent-2',
    ]))
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})
