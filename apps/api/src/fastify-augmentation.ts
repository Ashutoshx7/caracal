// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// FastifyInstance augmentation for API services. Kept in a dedicated module so
// route tests can import this file and share the same instance typing as buildApp.

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { DB } from './db.js'
import type { RedisClient } from './redis.js'
import type { Config } from './config.js'
import type { SecretBackend } from '@caracalai/server-core'

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
    redis: RedisClient
    cfg?: Config
    secrets: SecretBackend
    // Records the admin audit event for a response that is about to be hijacked. Hijacking
    // skips the onSend gate, so a streaming mutation must gate itself through this before it
    // writes a byte. Rejects when the record cannot be persisted.
    auditStreamStart: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export {}
