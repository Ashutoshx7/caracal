// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TypeScript shared logging tests for JSON emission and level filtering.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, redact, isSecretKey, SECRET_KEYS } from '../../../../packages/core/ts/src/logging.js'

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits structured JSON to stderr', () => {
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    })

    createLogger('api', 'info').info('ready', { port: 3000 })

    expect(JSON.parse(output)).toMatchObject({ level: 'info', service: 'api', msg: 'ready', port: 3000 })
  })

  it('filters messages below the configured level', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const logger = createLogger('sts', 'warn')
    logger.info('hidden')
    logger.error('visible')

    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({ level: 'error', msg: 'visible' })
  })

  it('redacts secret-keyed fields in emitted logs', () => {
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    })

    createLogger('api', 'debug').info('login', { user: 'alice', password: 'hunter2', api_key: 'k' })

    const parsed = JSON.parse(output)
    expect(parsed.user).toBe('alice')
    expect(parsed.password).toBe('***')
    expect(parsed.api_key).toBe('***')
  })

  it('with() returns a child logger with bound context', () => {
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    })

    createLogger('api', 'info').with({ request_id: 'r1', zone_id: 'z1' }).info('ok')

    const parsed = JSON.parse(output)
    expect(parsed).toMatchObject({ service: 'api', request_id: 'r1', zone_id: 'z1', msg: 'ok' })
  })

  it('with() redacts secrets in bound context too', () => {
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    })

    createLogger('api', 'info').with({ access_token: 't' }).info('ok')
    expect(JSON.parse(output).access_token).toBe('***')
  })
})

describe('redact', () => {
  it('handles nested objects and arrays', () => {
    const out = redact({
      ok: 1,
      Authorization: 'Bearer xyz',
      nested: { secret: 's', keep: 2 },
      list: [{ token: 't' }, { keep: 'v' }],
    })
    expect(out).toEqual({
      ok: 1,
      Authorization: '***',
      nested: { secret: '***', keep: 2 },
      list: [{ token: '***' }, { keep: 'v' }],
    })
  })

  it('isSecretKey is case-insensitive and substring', () => {
    expect(isSecretKey('X-Auth-Token')).toBe(true)
    expect(isSecretKey('user_password')).toBe(true)
    expect(isSecretKey('zone_id')).toBe(false)
  })

  it('exposes a frozen SECRET_KEYS list', () => {
    expect(Object.isFrozen(SECRET_KEYS)).toBe(true)
    expect(SECRET_KEYS).toContain('password')
  })
})