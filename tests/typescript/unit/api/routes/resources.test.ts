// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Resource route unit tests for same-zone provider ownership.

import { describe, it, expect, vi } from 'vitest'
import { resourcesRoutes } from '../../../../../apps/api/src/routes/resources.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

describe('POST /v1/zones/:zoneId/resources', () => {
  it('rejects provider references outside the zone', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/resources',
      payload: {
        identifier: 'resource://api',
        scopes: ['read'],
        credential_provider_id: 'provider-other-zone',
      },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'provider_not_found' })
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('creates a resource when provider belongs to the zone', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ exists: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'res-1', zone_id: 'z1', credential_provider_id: 'provider-1' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/resources',
      payload: {
        identifier: 'resource://api',
        scopes: ['read'],
        credential_provider_id: 'provider-1',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'res-1', credential_provider_id: 'provider-1' })
  })

  it('requires a gateway application for gateway-routed resources', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/resources',
      payload: {
        identifier: 'resource://api',
        upstream_url: 'https://api.example.com',
        scopes: ['read'],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'gateway_application_required' })
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('creates a gateway binding atomically with upstream resources', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'res-1',
            zone_id: 'z1',
            identifier: 'resource://api',
            upstream_url: 'https://api.example.com',
            scopes: ['read'],
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/resources',
      payload: {
        identifier: 'resource://api',
        upstream_url: 'https://api.example.com',
        scopes: ['read'],
        gateway_application_id: 'app-1',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'res-1', gateway_application_id: 'app-1' })
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gateway_resource_bindings'),
      ['resource://api', 'z1', 'app-1'],
    )
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })
})

describe('PATCH /v1/zones/:zoneId/resources/:id', () => {
  it('rejects provider rebinding outside the zone', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/resources/res-1',
      payload: { credential_provider_id: 'provider-other-zone' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'provider_not_found' })
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('moves the gateway binding when the resource identifier changes', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            identifier: 'resource://api',
            upstream_url: 'https://api.example.com',
            gateway_application_id: 'app-1',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'res-1',
            zone_id: 'z1',
            identifier: 'resource://api/v2',
            upstream_url: 'https://api.example.com',
            scopes: ['read'],
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/resources/res-1',
      payload: { identifier: 'resource://api/v2' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      identifier: 'resource://api/v2',
      gateway_application_id: 'app-1',
    })
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM gateway_resource_bindings'),
      ['resource://api', 'z1'],
    )
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gateway_resource_bindings'),
      ['resource://api/v2', 'z1', 'app-1'],
    )
  })
})

describe('DELETE /v1/zones/:zoneId/resources/:id', () => {
  it('archives the resource and removes its gateway binding atomically', async () => {
    const { app, db } = buildRouteApp(resourcesRoutes)
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ identifier: 'resource://api' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/zones/z1/resources/res-1',
    })

    expect(res.statusCode).toBe(204)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM gateway_resource_bindings'),
      ['resource://api', 'z1'],
    )
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })
})
