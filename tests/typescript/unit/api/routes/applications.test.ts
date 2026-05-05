// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Application route unit tests for dynamic client registration zone controls.

import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { applicationsRoutes } from '../../../../../apps/api/src/routes/applications.js'

function buildApp() {
  const app = Fastify({ logger: false })
  const db = {
    query: vi.fn(),
    connect: vi.fn(),
  }
  const redis = {
    incr: vi.fn(),
    expire: vi.fn(),
  }
  app.decorate('db', db as never)
  app.decorate('redis', redis as never)
  app.register(applicationsRoutes, { prefix: '/v1' })
  return { app, db, redis }
}

describe('POST /v1/zones/:zoneId/applications/dcr', () => {
  it('rejects DCR when the zone has disabled it', async () => {
    const { app, db, redis } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ dcr_enabled: false }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_disabled' })
    expect(redis.incr).not.toHaveBeenCalled()
  })

  it('creates a DCR application when the zone enables it', async () => {
    const { app, db, redis } = buildApp()
    db.query
      .mockResolvedValueOnce({ rows: [{ dcr_enabled: true }] })
      .mockResolvedValueOnce({ rows: [{ n: '0' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'app-1', zone_id: 'z1', registration_method: 'dcr' }] })
    redis.incr.mockResolvedValueOnce(1)
    redis.expire.mockResolvedValueOnce(1)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'app-1', registration_method: 'dcr' })
  })

  it('returns 429 when the DCR rate limit is exceeded', async () => {
    const { app, db, redis } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ dcr_enabled: true }] })
    redis.incr.mockResolvedValueOnce(11)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App' },
    })

    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_rate_limit_exceeded' })
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('returns 429 when the active DCR application cap is reached', async () => {
    const { app, db, redis } = buildApp()
    db.query
      .mockResolvedValueOnce({ rows: [{ dcr_enabled: true }] })
      .mockResolvedValueOnce({ rows: [{ n: '1000' }] })
    redis.incr.mockResolvedValueOnce(1)
    redis.expire.mockResolvedValueOnce(1)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App' },
    })

    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_limit_exceeded' })
  })
})