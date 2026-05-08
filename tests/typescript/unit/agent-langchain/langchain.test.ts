// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// LangChain adapter unit tests for runnable invocation and tool token wrapping.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentServiceConfig } from '../../../../packages/agent-core/ts/src/types.js'
import { LangChainAdapter } from '../../../../packages/framework-adaptor/agent-langchain/ts/src/langchain.js'

const config: AgentServiceConfig = {
  id: 'agent-a',
  url: 'https://agent.example.com',
  zoneId: 'zone1',
  clientId: 'zone1:agent-a',
  subjectToken: 'subject-token',
  agentSessionId: 'agent-session-1',
}

describe('LangChainAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tool-token', expires_in: 900 }),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a runnable before running', async () => {
    const adapter = new LangChainAdapter(config, 'https://sts.example.com')

    await expect(adapter.run({ value: 1 })).rejects.toThrow('LangChain runnable is required')
  })

  it('wraps tools with resource tokens', async () => {
    const runnable = { invoke: vi.fn() }
    const tool = { call: vi.fn().mockResolvedValue('done') }
    const adapter = new LangChainAdapter(config, 'https://sts.example.com', runnable)

    const wrapped = adapter.tool('resource://tool', tool, { scopes: ['invoke'] })

    await expect(wrapped({ prompt: 'go' })).resolves.toBe('done')
    expect(tool.call).toHaveBeenCalledWith({ prompt: 'go' }, { token: 'tool-token' })
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('scope')).toBe('invoke')
  })
})
