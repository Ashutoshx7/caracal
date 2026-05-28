// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Provider CRUD routes for upstream OAuth2 and API-key credential sources.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { buildPatchUpdate, patchColumn, patchExpression } from './patch.js'
import { ZoneIdParams, ZoneParams, parseParams } from './params.js'
import { zoneExists } from '../zone-guard.js'
import { appendKeysetCondition, parseListPagination, setNextLink } from './list-pagination.js'

const ProviderKind = z.enum(['oauth2', 'apikey'])
type ProviderKind = z.infer<typeof ProviderKind>

const ProviderCreateBody = z.object({
  name: z.string().min(1).optional(),
  identifier: z.string().min(1),
  kind: ProviderKind,
  config_json: z.record(z.string(), z.unknown()).optional(),
})

const ProviderPatchBody = ProviderCreateBody.partial()

const PROVIDER_CONFIG_KEYS: Record<ProviderKind, ReadonlySet<string>> = {
  oauth2: new Set(['token_endpoint', 'allowed_token_hosts', 'auth_header', 'auth_scheme', 'forward_caracal_identity']),
  apikey: new Set(['header_name', 'auth_scheme', 'forward_caracal_identity']),
}

function requireString(config: Record<string, unknown>, key: string, message: string): void {
  if (typeof config[key] !== 'string' || config[key].trim().length === 0) throw new Error(message)
}

function requireStringList(config: Record<string, unknown>, key: string, message: string): void {
  const value = config[key]
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(message)
  }
}

function requireOptionalString(config: Record<string, unknown>, key: string, message: string): void {
  if (config[key] !== undefined && typeof config[key] !== 'string') throw new Error(message)
}

function requireOptionalBoolean(config: Record<string, unknown>, key: string, message: string): void {
  if (config[key] !== undefined && typeof config[key] !== 'boolean') throw new Error(message)
}

function validateProviderConfig(kind: ProviderKind, input: Record<string, unknown> | undefined): Record<string, unknown> {
  const config = input ?? {}
  const allowed = PROVIDER_CONFIG_KEYS[kind]
  const unknown = Object.keys(config).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${kind} provider config has unsupported keys: ${unknown.join(', ')}`)
  if (kind === 'apikey') {
    requireString(config, 'header_name', 'apikey provider config requires header_name')
  } else {
    requireString(config, 'token_endpoint', 'oauth2 provider config requires token_endpoint')
    requireStringList(config, 'allowed_token_hosts', 'oauth2 provider config requires allowed_token_hosts')
    requireOptionalString(config, 'auth_header', 'oauth2 provider config auth_header must be a string')
  }
  requireOptionalString(config, 'auth_scheme', `${kind} provider config auth_scheme must be a string`)
  requireOptionalBoolean(config, 'forward_caracal_identity', `${kind} provider config forward_caracal_identity must be a boolean`)
  return config
}

interface ProviderRow {
  id: string
  zone_id: string
  name: string
  identifier: string
  kind: string
  config_json: unknown
  created_at: string
  updated_at: string
}

const RETURNING = `id, zone_id, name, identifier, provider_kind AS kind,
                  config_json, created_at, updated_at`

export const providersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/zones/:zoneId/providers', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    const page = parseListPagination(req, reply)
    if (!page) return
    const keyset = appendKeysetCondition(
      { conds: ['zone_id = $1', 'archived_at IS NULL'], values: [params.zoneId] },
      page,
    )
    const { rows } = await fastify.db.query<ProviderRow>(
      `SELECT ${RETURNING}
       FROM providers WHERE ${keyset.conds.join(' AND ')}
       ORDER BY created_at DESC, id DESC LIMIT ${keyset.limitPlaceholder}`,
      keyset.values,
    )
    setNextLink(req, reply, rows, page.limit)
    return rows
  })

  fastify.get('/zones/:zoneId/providers/:id', async (req, reply) => {
    const params = parseParams(ZoneIdParams, req, reply)
    if (!params) return
    const { rows } = await fastify.db.query<ProviderRow>(
      `SELECT ${RETURNING}
       FROM providers WHERE id = $1 AND zone_id = $2 AND archived_at IS NULL`,
      [params.id, params.zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'provider_not_found' })
    return rows[0]
  })

  fastify.post('/zones/:zoneId/providers', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    if (!(await zoneExists(fastify.db, params.zoneId))) {
      return reply.code(404).send({ error: 'zone_not_found' })
    }
    const parsed = ProviderCreateBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_provider' })
    const body = parsed.data
    const id = uuidv7()
    let config: Record<string, unknown>
    try {
      config = validateProviderConfig(body.kind, body.config_json)
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_provider_config', message: err instanceof Error ? err.message : String(err) })
    }
    const { rows } = await fastify.db.query<ProviderRow>(
      `INSERT INTO providers (id, zone_id, name, identifier, provider_kind, config_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING ${RETURNING}`,
      [
        id,
        params.zoneId,
        body.name ?? body.identifier,
        body.identifier,
        body.kind,
        JSON.stringify(config),
      ],
    )
    return reply.code(201).send(rows[0])
  })

  fastify.patch('/zones/:zoneId/providers/:id', async (req, reply) => {
    const params = parseParams(ZoneIdParams, req, reply)
    if (!params) return
    const parsed = ProviderPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_provider' })
    const body = parsed.data

    if (body.kind !== undefined && body.config_json === undefined) {
      return reply.code(400).send({ error: 'provider_config_required' })
    }
    let config: Record<string, unknown> | undefined
    if (body.config_json !== undefined) {
      let kind = body.kind
      if (!kind) {
        const { rows } = await fastify.db.query<{ kind: ProviderKind }>(
          `SELECT provider_kind AS kind FROM providers WHERE id = $1 AND zone_id = $2 AND archived_at IS NULL`,
          [params.id, params.zoneId],
        )
        if (!rows[0]) return reply.code(404).send({ error: 'provider_not_found' })
        kind = rows[0].kind
      }
      try {
        config = validateProviderConfig(kind, body.config_json)
      } catch (err) {
        return reply.code(400).send({ error: 'invalid_provider_config', message: err instanceof Error ? err.message : String(err) })
      }
    }

    const update = buildPatchUpdate([params.id, params.zoneId], [
      patchColumn('name', body.name),
      patchColumn('identifier', body.identifier),
      patchColumn('provider_kind', body.kind),
      patchExpression(
        config ? JSON.stringify(config) : undefined,
        (placeholder) => `config_json = ${placeholder}::jsonb`,
      ),
    ])
    if (!update) return reply.code(400).send({ error: 'no_fields' })
    const { rows } = await fastify.db.query<ProviderRow>(
      `UPDATE providers SET ${update.sets.join(', ')}, updated_at = now()
       WHERE id = $1 AND zone_id = $2 AND archived_at IS NULL
       RETURNING ${RETURNING}`,
      update.values,
    )
    if (!rows[0]) return reply.code(404).send({ error: 'provider_not_found' })
    return rows[0]
  })

  fastify.delete('/zones/:zoneId/providers/:id', async (req, reply) => {
    const params = parseParams(ZoneIdParams, req, reply)
    if (!params) return
    const { rowCount } = await fastify.db.query(
      `UPDATE providers SET archived_at = now(), updated_at = now()
       WHERE id = $1 AND zone_id = $2 AND archived_at IS NULL`,
      [params.id, params.zoneId],
    )
    if (!rowCount) return reply.code(404).send({ error: 'provider_not_found' })
    return reply.code(204).send()
  })
}
