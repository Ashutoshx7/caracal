// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Self-contained mock that mints short-lived scoped tokens (STS) and accepts only those tokens at an OpenAI-compatible endpoint.

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const RESOURCE_OPENAI = 'resource://openai'

/**
 * Start a combined STS + OpenAI-compatible provider on one port.
 *
 * The STS path mints a short-lived token bound to the requested resource and
 * records it in memory. The provider path accepts a request only if the bearer
 * matches a minted, unexpired, correctly scoped token. This mirrors the intended
 * `caracal run` model: Caracal mints a scoped, short-lived credential at launch,
 * the workload uses it from memory, and exposure ends when the token expires.
 *
 * @param {{ ttlSeconds?: number }} [opts]
 */
export function startMockProvider(opts = {}) {
  const ttlSeconds = opts.ttlSeconds ?? 120
  const minted = new Map()

  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => handle(req, res, body))
  })

  function handle(req, res, body) {
    if (req.method === 'POST' && req.url?.endsWith('/oauth/2/token')) {
      return mintToken(res, body)
    }
    if (req.method === 'POST' && req.url?.endsWith('/v1/chat/completions')) {
      return chatCompletions(req, res, body)
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found')
  }

  function mintToken(res, body) {
    const params = new URLSearchParams(body)
    const resource = params.get('resource') ?? ''
    if (resource !== RESOURCE_OPENAI) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'access_denied', error_description: `denied: ${resource}` }))
      return
    }
    const token = `sk-caracal-${randomBytes(9).toString('hex')}`
    minted.set(token, { resource, expiresAt: Date.now() + ttlSeconds * 1000 })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: ttlSeconds }))
  }

  function chatCompletions(req, res, body) {
    const auth = req.headers['authorization'] ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const grant = minted.get(token)
    if (!grant) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'invalid_api_key', type: 'invalid_request_error' } }))
      return
    }
    if (grant.expiresAt < Date.now()) {
      minted.delete(token)
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'token_expired', type: 'invalid_request_error' } }))
      return
    }
    if (grant.resource !== RESOURCE_OPENAI) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'out_of_scope', type: 'invalid_request_error' } }))
      return
    }
    const parsed = JSON.parse(body || '{}')
    const lastUser = [...(parsed.messages ?? [])].reverse().find((m) => m.role === 'user')
    const reply = `ack: ${String(lastUser?.content ?? '').slice(0, 120)}`
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      model: parsed.model ?? 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    }))
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = /** @type {import('node:net').AddressInfo} */ (server.address())
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        mintedCount: () => minted.size,
        expireAll: () => { for (const g of minted.values()) g.expiresAt = 0 },
        close: () => new Promise((done, fail) => server.close((err) => err ? fail(err) : done(undefined))),
      })
    })
  })
}
