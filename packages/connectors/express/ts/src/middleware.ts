// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Express middleware that delegates MCP auth to @caracalai/transport-mcp.

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Claims } from '@caracalai/identity'
import { authenticate, extractBearer, type AuthDeps, type AuthError } from '@caracalai/transport-mcp'
import {
  bind,
  fromHeaders,
  type CaracalContext,
} from '@caracalai/sdk/advanced'

export interface MiddlewareOptions extends AuthDeps {
  bindContext?: boolean
}

export interface CaracalRequest extends Request {
  caracalClaims?: Claims
  caracalContext?: CaracalContext
}

export function caracalAuth(opts: MiddlewareOptions): RequestHandler {
  return async (req: CaracalRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearer(req.headers['authorization'])
    if (!token) {
      res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token' })
      return
    }

    const result = await authenticate(token, opts)
    if (!result.ok) {
      const { status, body } = mapError(result.error)
      res.status(status).json(body)
      return
    }

    req.caracalClaims = result.principal

    const env = fromHeaders(req.headers as Record<string, string | string[] | undefined>)
    const baseCtx: CaracalContext = {
      subjectToken: token,
      zoneId: result.principal.zoneId ?? opts.zoneId ?? '',
      clientId: result.principal.clientId ?? '',
      agentSessionId: env.agentSessionId ?? result.principal.agentSessionId,
      delegationEdgeId: env.delegationEdgeId ?? result.principal.delegationEdgeId,
      parentEdgeId: env.parentEdgeId,
      sessionId: result.principal.sid,
      traceId: env.traceId,
      hop: env.hop,
    }
    req.caracalContext = baseCtx

    if (opts.bindContext === false) {
      next()
      return
    }

    bind(baseCtx, () => {
      next()
    })
  }
}

function mapError(err: AuthError): { status: number; body: { error: string; error_description: string } } {
  if (err.code === 'insufficient_scope') {
    return { status: 403, body: { error: 'insufficient_scope', error_description: err.description } }
  }
  if (err.code === 'agent_required' || err.code === 'delegation_required') {
    return { status: 403, body: { error: err.code, error_description: err.description } }
  }
  return { status: 401, body: { error: 'invalid_token', error_description: err.description } }
}
