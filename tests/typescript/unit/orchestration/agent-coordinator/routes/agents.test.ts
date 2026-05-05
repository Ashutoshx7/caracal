// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent spawn, limits, and cascade termination unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { agentsRoutes } from '../../../../../../apps/agent-coordinator/src/routes/agents.js'

function buildApp() {
  const app = Fastify({ logger: false })
  const db = {
    query: vi.fn(),
    connect: vi.fn(),
  }
  const redis = { xadd: vi.fn() }
  app.decorate('db', db as never)
  app.decorate('redis', redis as never)
  app.register(agentsRoutes, { prefix: '/v1' })
  return { app, db, redis }
}

function mockClient(...responses: Array<{ rows: unknown[] }>) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, session_exists: true }] })
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1] ?? { rows: [] })
      .mockResolvedValueOnce({ rows: [] }),
    release: vi.fn(),
  }
}

describe('POST /v1/zones/:zoneId/agents — spawn', () => {
  it('rejects applications outside the zone', async () => {
    const { app, db } = buildApp()
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ application_exists: false, session_exists: true }] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-other-zone', session_sid: 'sid-1' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'application_not_found' })
  })

  it('rejects inactive or cross-zone sessions', async () => {
    const { app, db } = buildApp()
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ application_exists: true, session_exists: false }] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-1', session_sid: 'sid-other-zone' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'session_not_found' })
  })

  it('returns 429 when total agent cap is reached', async () => {
    const { app, db } = buildApp()
    db.connect.mockResolvedValueOnce(mockClient({ rows: [{ n: '50' }] }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-1', session_sid: 'sid-1' },
    })
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'agent_limit_exceeded' })
  })

  it('returns 404 when parent not found', async () => {
    const { app, db } = buildApp()
    db.connect.mockResolvedValueOnce(mockClient({ rows: [{ n: '0' }] }, { rows: [] }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-1', session_sid: 'sid-1', parent_id: 'missing-parent' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'parent_not_found' })
  })

  it('rejects when parent children cap is reached', async () => {
    const { app, db } = buildApp()
    db.connect.mockResolvedValueOnce(mockClient(
      { rows: [{ n: '1' }] },
      { rows: [{ depth: 1, child_count: 10, max_children: 10 }] },
    ))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-1', session_sid: 'sid-1', parent_id: 'parent-1' },
    })
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'agent_children_limit_exceeded' })
  })

  it('rejects when max depth is exceeded', async () => {
    const { app, db } = buildApp()
    db.connect.mockResolvedValueOnce(mockClient(
      { rows: [{ n: '1' }] },
      { rows: [{ depth: 10, child_count: 0, max_children: 10 }] },
    ))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agents',
      payload: { application_id: 'app-1', session_sid: 'sid-1', parent_id: 'parent-1' },
    })
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'agent_depth_limit_exceeded' })
  })
})

describe('GET /v1/zones/:zoneId/agents/:id', () => {
  it('returns 404 when agent not found', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValue({ rows: [] })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/agents/missing' })
    expect(res.statusCode).toBe(404)
  })
})
