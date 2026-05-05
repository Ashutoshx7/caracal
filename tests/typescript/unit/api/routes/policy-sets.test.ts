// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Policy set route unit tests for activation contract checks.

import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { policySetsRoutes } from '../../../../../apps/api/src/routes/policy-sets.js'

function buildApp() {
  const app = Fastify({ logger: false })
  const db = {
    query: vi.fn(),
    connect: vi.fn(),
  }
  const redis = { xadd: vi.fn() }
  app.decorate('db', db as any)
  app.decorate('redis', redis as any)
  app.register(policySetsRoutes, { prefix: '/v1' })
  return { app, db, redis }
}

describe('POST /v1/zones/:zoneId/policy-sets/:id/activate', () => {
  it('rejects policies that do not emit result', async () => {
    const { app, db } = buildApp()
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: [{ policy_version_id: 'pv-1' }] }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\ndefault allow = false' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/activate',
      payload: { version_id: 'psv-1' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_policy_contract' })
  })

  it('activates valid active and shadow versions', async () => {
    const { app, db, redis } = buildApp()
    const manifest = [{ policy_version_id: 'pv-1' }]
    const content = 'package caracal.authz\nresult := {"allow": true}'
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: manifest }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content }] })
      .mockResolvedValueOnce({ rows: [{ id: 'psv-shadow', manifest_json: manifest }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/activate',
      payload: { version_id: 'psv-1', shadow_version_id: 'psv-shadow' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ activated: true, shadow_version_id: 'psv-shadow' })
    expect(redis.xadd).toHaveBeenCalledWith(
      'caracal.policy.invalidate',
      '*',
      'zone_id', 'z1',
      'policy_set_version_id', 'psv-1',
    )
  })
})