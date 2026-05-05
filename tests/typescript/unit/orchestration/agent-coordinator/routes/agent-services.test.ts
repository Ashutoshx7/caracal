// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent service route unit tests for registration and heartbeat.

import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { agentServicesRoutes } from '../../../../../../apps/agent-coordinator/src/routes/agent-services.js'

function buildApp() {
  const app = Fastify({ logger: false })
  const db = {
    query: vi.fn(),
    connect: vi.fn(),
  }
  app.decorate('db', db as never)
  app.decorate('redis', { xadd: vi.fn() } as never)
  app.register(agentServicesRoutes, { prefix: '/v1' })
  return { app, db }
}

describe('POST /v1/zones/:zoneId/agent-services', () => {
  it('registers an agent service', async () => {
    const { app, db } = buildApp()
    db.query
      .mockResolvedValueOnce({ rows: [{ exists: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'svc-1', zone_id: 'z1', application_id: 'app-1' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agent-services',
      payload: {
        application_id: 'app-1',
        endpoint_url: 'https://agent.example.test/invoke',
        protocol_versions: ['2026-03-16'],
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'svc-1', application_id: 'app-1' })
  })

  it('rejects applications outside the zone', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/agent-services',
      payload: {
        application_id: 'app-other-zone',
        endpoint_url: 'https://agent.example.test/invoke',
      },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'application_not_found' })
  })
})

describe('POST /v1/agents/:id/heartbeat', () => {
  it('returns 404 when the agent session is inactive', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/agents/agent-1/heartbeat',
      payload: { status: 'healthy' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'agent_not_found' })
  })
})