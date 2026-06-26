// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Operator execution engine: handler dispatch, support gating, and rollback signaling.

import { describe, it, expect, vi } from 'vitest'
import type { TxClient } from '../../../../apps/api/src/db.js'
import { isExecutable, unsupportedSteps, applyPlanSteps, StepExecutionError } from '../../../../apps/api/src/operator-execute.js'

function clientReturning(rowsByCall: unknown[][]): TxClient {
  const query = vi.fn()
  for (const rows of rowsByCall) query.mockResolvedValueOnce({ rows })
  query.mockResolvedValue({ rows: [] })
  return { query } as unknown as TxClient
}

describe('execution support gating', () => {
  it('recognizes executable capabilities', () => {
    expect(isExecutable('createZone')).toBe(true)
    expect(isExecutable('registerApplication')).toBe(true)
    expect(isExecutable('grantAccess')).toBe(false)
    expect(isExecutable('listZones')).toBe(false)
  })

  it('identifies steps without an execution handler', () => {
    const steps = [
      { id: 's1', capability: 'createZone', args: { name: 'Prod' } },
      { id: 's2', capability: 'grantAccess', args: {} },
    ]
    expect(unsupportedSteps(steps).map((s) => s.id)).toEqual(['s2'])
  })
})

describe('applyPlanSteps', () => {
  it('applies a createZone step and returns a ledger-safe detail', async () => {
    // createZoneRecord first checks slug availability, then inserts.
    const client = clientReturning([[], [{ id: 'z-new', name: 'Prod', slug: 'prod' }]])
    const result = await applyPlanSteps(client, 'z1', [{ id: 's1', capability: 'createZone', args: { name: 'Prod' } }])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 's1', capability: 'createZone' })
    expect(result[0].detail).toContain('Prod')
    expect(result[0].output).toMatchObject({ zone_id: 'z-new' })
  })

  it('returns the issued secret as a one-time output, never in the detail', async () => {
    const client = clientReturning([[{ id: 'app-new', name: 'worker' }]])
    const result = await applyPlanSteps(client, 'z1', [{ id: 's1', capability: 'registerApplication', args: { name: 'worker' } }])
    expect(result[0].output?.client_secret).toMatch(/^cs_/)
    expect(result[0].detail).not.toContain('cs_')
  })

  it('throws StepExecutionError carrying the failed step on handler failure', async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new Error('insert failed')),
    } as unknown as TxClient
    await expect(applyPlanSteps(client, 'z1', [{ id: 's1', capability: 'createZone', args: { name: 'Prod' } }])).rejects.toMatchObject({
      name: 'StepExecutionError',
      stepId: 's1',
      capability: 'createZone',
    })
  })

  it('refuses a step whose capability has no handler', async () => {
    const client = clientReturning([])
    await expect(applyPlanSteps(client, 'z1', [{ id: 's1', capability: 'grantAccess', args: {} }])).rejects.toBeInstanceOf(
      StepExecutionError,
    )
  })
})
