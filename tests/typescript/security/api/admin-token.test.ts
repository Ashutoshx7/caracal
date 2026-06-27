// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API admin-token security tests for protected management routes.

import { describe, it, expect } from 'vitest'
import type { DB } from '../../../../apps/api/src/db.js'
import type { RedisClient } from '../../../../apps/api/src/redis.js'
import { buildApp } from '../../../../apps/api/src/app.js'
import { apiAppDeps } from '../../../shared/test-utils/typescript/api-app.js'

describe('API admin token enforcement', () => {
  it('allows health checks without admin credentials', async () => {
    const { cfg, db, redis } = apiAppDeps()
    const app = await buildApp({ cfg, db: db as unknown as DB, redis: redis as unknown as RedisClient })

    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    await app.close()
  })

  it('rejects protected management routes when no token is presented', async () => {
    const { cfg, db, redis } = apiAppDeps()
    const app = await buildApp({ cfg, db: db as unknown as DB, redis: redis as unknown as RedisClient })

    const res = await app.inject({ method: 'GET', url: '/v1/zones' })

    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_admin_token' })
    await app.close()
  })

  it('allows protected management routes with the exact bearer token', async () => {
    const { cfg, db, redis } = apiAppDeps()
    const app = await buildApp({ cfg, db: db as unknown as DB, redis: redis as unknown as RedisClient })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Bearer admin-secret' },
    })

    expect(res.statusCode).toBe(200)
    const calls = db.query.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.some((sql) => sql.includes('FROM zones'))).toBe(true)
    await app.close()
  })

  it('denies a derived Console token the admin-token management surface', async () => {
    const { cfg, db, redis } = apiAppDeps({ adminCreatedBy: 'env-derived-write' })
    const app = await buildApp({ cfg, db: db as unknown as DB, redis: redis as unknown as RedisClient })

    const mint = await app.inject({
      method: 'POST',
      url: '/v1/admin-tokens',
      headers: { authorization: 'Bearer admin-secret' },
      payload: { name: 'escalate', scope: 'global' },
    })
    expect(mint.statusCode).toBe(403)
    expect(JSON.parse(mint.body)).toMatchObject({ error: 'admin_token_management_forbidden_for_derived_token' })

    const revoke = await app.inject({
      method: 'DELETE',
      url: '/v1/admin-tokens/some-id',
      headers: { authorization: 'Bearer admin-secret' },
    })
    expect(revoke.statusCode).toBe(403)
    expect(JSON.parse(revoke.body)).toMatchObject({ error: 'admin_token_management_forbidden_for_derived_token' })

    const inserted = db.query.mock.calls.some((c: unknown[]) => String(c[0]).startsWith('INSERT INTO admin_tokens'))
    expect(inserted).toBe(false)
    await app.close()
  })
})
