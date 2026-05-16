// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Delegated grant route unit tests for same-zone references and scope boundaries.

import { describe, it, expect, vi } from 'vitest'
import { grantsRoutes } from '../../../../../apps/api/src/routes/grants.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

const grantBody = {
  application_id: 'app-1',
  user_id: 'user-1',
  resource_id: 'res-1',
  scopes: ['read'],
}

describe('POST /v1/zones/:zoneId/grants', () => {
  it('rejects application references outside the zone', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: false, resource_scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'application_not_found' })
  })

  it('rejects resource references outside the zone', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: null }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'resource_not_found' })
  })

  it('rejects grant scopes outside the resource scope set', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/grants',
      payload: { ...grantBody, scopes: ['write'] },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'grant_scopes_exceed_resource' })
  })

  it('creates a grant with same-zone references and bounded scopes', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: ['read', 'write'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 'grant-1', zone_id: 'z1', scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'grant-1', scopes: ['read'] })
  })
})

describe('DELETE /v1/zones/:zoneId/grants/:id bounded session revocation', () => {
  it('pages session revocation in batches of 1000 and stops at the short batch', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)

    const fullBatch = Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}` }))
    const tailBatch = [{ id: 's-tail' }]

    const client = {
      query: vi.fn(),
      release: vi.fn(),
    }
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: fullBatch })

    for (let i = 0; i < fullBatch.length; i += 1) {
      client.query.mockResolvedValueOnce({ rows: [] })
    }

    client.query.mockResolvedValueOnce({ rows: tailBatch })
    client.query.mockResolvedValueOnce({ rows: [] })
    client.query.mockResolvedValueOnce({ rows: [] })

    db.connect.mockResolvedValue(client)

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/grants/g1' })

    expect(res.statusCode).toBe(204)
    const updates = client.query.mock.calls.filter((c: unknown[]) => /UPDATE sessions SET status = 'revoked'/.test(c[0] as string))
    expect(updates.length).toBe(2)
    const limitArg = (updates[0][1] as unknown[])[2]
    expect(limitArg).toBe(1000)
  })
})
