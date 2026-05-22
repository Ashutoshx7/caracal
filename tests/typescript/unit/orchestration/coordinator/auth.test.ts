// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator bearer authentication guard unit tests.

import { describe, expect, it } from 'vitest'
import Fastify from 'fastify'
import '../../../../shared/test-utils/typescript/coordinatorEnv.js'
import { verifyBearer } from '../../../../../apps/coordinator/src/auth.js'

function jwtWith(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

function buildApp() {
  const app = Fastify({ logger: false })
  app.addHook('preHandler', verifyBearer)
  app.get('/secure', async () => ({ ok: true }))
  app.get('/stats', async () => ({ ok: true }))
  return app
}

describe('coordinator bearer authentication', () => {
  it('rejects oversized bearer tokens before decoding', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/secure',
      headers: { authorization: `Bearer ${'x'.repeat(4097)}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'missing_token' })
  })

  it('rejects malformed decoded zone ids before JWKS resolution', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/secure',
      headers: { authorization: `Bearer ${jwtWith({ zone_id: '../z1' })}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'invalid_token' })
  })

  it('accepts the managed operator token only on metrics endpoints', async () => {
    const app = buildApp()
    await app.ready()

    const stats = await app.inject({
      method: 'GET',
      url: '/stats',
      headers: { authorization: 'Bearer coordinator-operator-token' },
    })
    const secure = await app.inject({
      method: 'GET',
      url: '/secure',
      headers: { authorization: 'Bearer coordinator-operator-token' },
    })

    expect(stats.statusCode).toBe(200)
    expect(secure.statusCode).toBe(401)
    expect(secure.json()).toEqual({ error: 'invalid_token' })
  })
})
