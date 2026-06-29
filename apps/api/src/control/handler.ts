// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// /v1/control/invoke handler: rate-limits, authenticates, blocks JTI replay, and dispatches through the shared engine.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  dispatch,
  DispatchError,
  findCommand,
  scopeFor,
  MANAGEMENT_COMMANDS,
  type DispatchContext,
  type FlagMap,
  type Principal,
} from '@caracalai/engine'
import { Authenticator, AuthError } from './auth.js'
import { newRequestId, type EventSink } from './audit.js'
import type { Replay } from './replay.js'
import type { RateLimiter } from './ratelimit.js'
import type { ControlGate } from './gate.js'
import { redisMinuteBucket, type RedisClient } from '../redis.js'

const MAX_BODY_BYTES = 64 * 1024

// The header the in-process Operator reader stamps to read a tenant zone's live state. The token
// is minted in the reader's own (system) zone; this names the zone the read targets. It is honored
// only for the reserved Operator reader subject and only for non-mutating commands, so it grants a
// read-only cross-zone view to the platform identity and nothing else — a tenant's own control key
// can never use it to read another zone.
const ZONE_SCOPE_HEADER = 'x-caracal-zone-scope'

interface InvokeBody {
  command?: unknown
  subcommand?: unknown
  flags?: unknown
}

export interface InvokeDeps {
  auth: Authenticator
  replay: Replay
  rate: RateLimiter
  sink: EventSink
  ctx: DispatchContext
  gate: ControlGate
  redis: RedisClient
  // Pre-authentication per-IP request ceiling that throttles unauthenticated
  // floods before they reach JWT verification and JWKS fetches. 0 disables it.
  ipRateLimitPerMin: number
  // The application id of the reserved Operator reader, or null when self-governance is not
  // configured. Only this subject may use the zone-scope header to read a tenant zone it is not
  // bound to, and only for non-mutating commands. Resolved lazily because the identity is
  // provisioned after the server is listening.
  resolvePlatformReaderSubject?: () => string | null
}

// Whether a control command/subcommand is a non-mutating read, derived from the engine's command
// metadata so the cross-zone read gate can never drift from the real scope verb of a command. An
// unknown command is treated as not-read, so the gate fails closed.
function isReadCommand(command: string, subcommand: string): boolean {
  const desc = findCommand(MANAGEMENT_COMMANDS, command)
  if (!desc) return false
  return scopeFor(desc, subcommand) === 'read'
}

// Resolves the zone a request acts in. A request normally acts in the token's own zone. The
// reserved Operator reader may target another zone for a non-mutating read by stamping the
// zone-scope header; any other use of the header is ignored and the token's own zone applies, so
// the header can never widen authority for a tenant key or for a mutating command.
function resolveEffectiveZone(
  req: FastifyRequest,
  deps: InvokeDeps,
  claims: { sub: string; zoneId?: string },
  command: string,
  subcommand: string,
): string | undefined {
  const requested = req.headers[ZONE_SCOPE_HEADER]
  const target = typeof requested === 'string' ? requested.trim() : ''
  if (!target || target === claims.zoneId) return claims.zoneId
  const readerSubject = deps.resolvePlatformReaderSubject?.() ?? null
  if (readerSubject && claims.sub === readerSubject && isReadCommand(command, subcommand)) return target
  return claims.zoneId
}

export function registerInvokeRoute(app: FastifyInstance, deps: InvokeDeps): void {
  app.post(
    '/v1/control/invoke',
    {
      bodyLimit: MAX_BODY_BYTES,
      config: { rawBody: false },
    },
    (req, reply) => handle(req, reply, deps),
  )
}

async function handle(req: FastifyRequest, reply: FastifyReply, deps: InvokeDeps): Promise<void> {
  const requestId = newRequestId()
  reply.header('x-request-id', requestId)
  if (!deps.gate.enabled()) {
    await deps.sink.emit({
      at: new Date(),
      subject: 'anonymous',
      jti: '',
      decision: 'deny',
      reason: 'control disabled',
      requestId,
    })
    return reply.code(503).send({ error: 'control disabled' })
  }

  if (await ipRateExceeded(deps.redis, req.ip, deps.ipRateLimitPerMin)) {
    await deps.sink.emit({
      at: new Date(),
      subject: 'anonymous',
      jti: '',
      decision: 'deny',
      reason: 'ip rate limited',
      requestId,
    })
    return reply.code(429).send({ error: 'rate limited' })
  }

  let claims
  try {
    claims = await deps.auth.verify(req.headers.authorization)
  } catch (err) {
    await deps.sink.emit({
      at: new Date(),
      subject: 'anonymous',
      jti: '',
      decision: 'deny',
      reason: 'auth: ' + describe(err),
      requestId,
    })
    return reply.code(401).send({ error: 'unauthorized' })
  }

  if (!(await deps.replay.mark(claims.jti, claims.exp))) {
    await deps.sink.emit({
      at: new Date(),
      zoneId: claims.zoneId,
      clientId: claims.clientId,
      subject: claims.sub,
      jti: claims.jti,
      decision: 'deny',
      reason: 'replay',
      requestId,
    })
    return reply.code(401).send({ error: 'token replay' })
  }
  if (!deps.rate.allow(claims.sub)) {
    await deps.sink.emit({
      at: new Date(),
      zoneId: claims.zoneId,
      clientId: claims.clientId,
      subject: claims.sub,
      jti: claims.jti,
      decision: 'deny',
      reason: 'rate limited',
      requestId,
    })
    return reply.code(429).send({ error: 'rate limited' })
  }

  const body = req.body as InvokeBody | null
  const command = typeof body?.command === 'string' ? body.command : ''
  const subcommand = typeof body?.subcommand === 'string' ? body.subcommand : ''
  const flags = body?.flags && typeof body.flags === 'object' && !Array.isArray(body.flags) ? (body.flags as FlagMap) : undefined
  const idempotencyKey = typeof flags?.['idempotency-key'] === 'string' ? (flags['idempotency-key'] as string) : undefined

  // The zone the request acts in: the token's own zone, or a tenant zone the reserved Operator
  // reader targets for a non-mutating read. The audit records the effective zone, so a cross-zone
  // read is attributed to the zone actually read.
  const effectiveZone = resolveEffectiveZone(req, deps, claims, command, subcommand)

  const principal: Principal = {
    kind: 'remote',
    subject: claims.sub,
    zoneId: effectiveZone,
    clientId: claims.clientId,
    scopes: claims.scope.split(/\s+/).filter((s) => s.length > 0),
  }

  try {
    const result = await dispatch({ command, subcommand, flags }, principal, deps.ctx)
    await deps.sink.emit({
      at: new Date(),
      zoneId: effectiveZone,
      clientId: claims.clientId,
      subject: claims.sub,
      jti: claims.jti,
      command,
      subcommand,
      decision: 'allow',
      requestId,
      idempotencyKey,
    })
    return reply.code(200).send({ ok: true, result })
  } catch (err) {
    const reason = describe(err)
    await deps.sink.emit({
      at: new Date(),
      zoneId: effectiveZone,
      clientId: claims.clientId,
      subject: claims.sub,
      jti: claims.jti,
      command,
      subcommand,
      decision: 'deny',
      reason,
      requestId,
      idempotencyKey,
    })
    if (err instanceof DispatchError) {
      const status = STATUS_FOR_CODE[err.code] ?? 400
      return reply.code(status).send({ ok: false, error: errorBody(err.code, reason, err.remediation) })
    }
    req.log.error({ command }, 'upstream error: ' + reason)
    return reply.code(502).send({ ok: false, error: errorBody('upstream', 'upstream error') })
  }
}

const STATUS_FOR_CODE: Record<string, number> = {
  denied: 403,
  invalid: 400,
  unsupported: 501,
  zone_mismatch: 409,
  conflict: 409,
  not_found: 404,
  upstream: 502,
}

function errorBody(code: string, reason: string, remediation?: string): Record<string, string> {
  return remediation ? { code, reason, remediation } : { code, reason }
}

function describe(err: unknown): string {
  if (err instanceof AuthError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

async function ipRateExceeded(redis: RedisClient, ip: string, limitPerMin: number): Promise<boolean> {
  if (limitPerMin <= 0) return false
  const minute = await redisMinuteBucket(redis)
  const key = `api:control_invoke_ip:${ip}:${minute}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 90)
  return count > limitPerMin
}
