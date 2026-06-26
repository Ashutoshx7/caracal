// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Operator LLM gateway: provider selection, failover, timeout, and key redaction.

import { describe, it, expect, vi } from 'vitest'
import { createGateway, GatewayUnavailableError, GatewayError, type ProviderConfig } from '../../../../apps/api/src/operator-gateway.js'

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return { id: 'p1', baseUrl: 'https://api.example.com/v1', model: 'gpt-x', timeoutMs: 1000, ...overrides }
}

function chatResponse(content: string, usage?: { prompt_tokens: number; completion_tokens: number }): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('gateway status', () => {
  it('reports disabled with no providers', () => {
    const gateway = createGateway([])
    expect(gateway.status()).toEqual({ enabled: false, providers: [] })
  })

  it('reports each provider availability without leaking keys', () => {
    const gateway = createGateway([provider({ id: 'primary', apiKey: 'sk-secret' }), provider({ id: 'broken', baseUrl: '' })])
    const status = gateway.status()
    expect(status.enabled).toBe(true)
    expect(status.providers).toEqual([
      { id: 'primary', model: 'gpt-x', available: true },
      { id: 'broken', model: 'gpt-x', available: false },
    ])
    // The serialized status must never contain the key.
    expect(JSON.stringify(status)).not.toContain('sk-secret')
  })
})

describe('gateway complete', () => {
  it('throws GatewayUnavailableError when nothing is configured', async () => {
    const gateway = createGateway([])
    await expect(gateway.complete([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(GatewayUnavailableError)
  })

  it('calls the OpenAI-compatible endpoint with the bearer key and returns the completion', async () => {
    const fetchMock = vi.fn(async () => chatResponse('OK', { prompt_tokens: 3, completion_tokens: 1 }))
    const gateway = createGateway([provider({ apiKey: 'sk-secret' })], fetchMock as unknown as typeof fetch)
    const result = await gateway.complete([{ role: 'user', content: 'ping' }], { maxTokens: 5 })
    expect(result).toMatchObject({ text: 'OK', provider: 'p1', model: 'gpt-x', promptTokens: 3, completionTokens: 1 })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-secret')
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'gpt-x', max_tokens: 5, stream: false })
  })

  it('omits the authorization header for a keyless local provider', async () => {
    const fetchMock = vi.fn(async () => chatResponse('OK'))
    const gateway = createGateway(
      [provider({ id: 'local', baseUrl: 'http://localhost:11434/v1', model: 'llama' })],
      fetchMock as unknown as typeof fetch,
    )
    await gateway.complete([{ role: 'user', content: 'ping' }])
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('fails over to the next provider on a 5xx response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(chatResponse('OK'))
    const gateway = createGateway([provider({ id: 'primary' }), provider({ id: 'secondary' })], fetchMock as unknown as typeof fetch)
    const result = await gateway.complete([{ role: 'user', content: 'ping' }])
    expect(result.provider).toBe('secondary')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails over on a network error', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('connection refused')).mockResolvedValueOnce(chatResponse('OK'))
    const gateway = createGateway([provider({ id: 'primary' }), provider({ id: 'secondary' })], fetchMock as unknown as typeof fetch)
    const result = await gateway.complete([{ role: 'user', content: 'ping' }])
    expect(result.provider).toBe('secondary')
  })

  it('throws GatewayError listing redacted attempts when every provider fails', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }))
    const gateway = createGateway(
      [provider({ id: 'primary', apiKey: 'sk-secret' }), provider({ id: 'secondary', apiKey: 'sk-other' })],
      fetchMock as unknown as typeof fetch,
    )
    const error = await gateway.complete([{ role: 'user', content: 'ping' }]).catch((e) => e)
    expect(error).toBeInstanceOf(GatewayError)
    expect(error.attempts).toHaveLength(2)
    expect(error.attempts.map((a: { provider: string }) => a.provider)).toEqual(['primary', 'secondary'])
    expect(JSON.stringify(error.attempts)).not.toContain('sk-')
  })

  it('treats an empty completion as a failure and fails over', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(chatResponse('')).mockResolvedValueOnce(chatResponse('OK'))
    const gateway = createGateway([provider({ id: 'primary' }), provider({ id: 'secondary' })], fetchMock as unknown as typeof fetch)
    const result = await gateway.complete([{ role: 'user', content: 'ping' }])
    expect(result.provider).toBe('secondary')
  })

  it('aborts a provider that exceeds its timeout and fails over', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      )
      .mockResolvedValueOnce(chatResponse('OK'))
    const gateway = createGateway([provider({ id: 'slow', timeoutMs: 10 }), provider({ id: 'fast' })], fetchMock as unknown as typeof fetch)
    const result = await gateway.complete([{ role: 'user', content: 'ping' }])
    expect(result.provider).toBe('fast')
  })
})
