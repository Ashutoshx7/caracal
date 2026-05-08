// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CustomPipelineAdapter unit tests for adapter context tool dispatch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentServiceConfig } from '../../../../packages/agent-core/ts/src/types.js'
import { CustomPipelineAdapter } from '../../../../packages/agent-core/ts/src/adapters/custom.js'

const config: AgentServiceConfig = {
  id: 'agent-a',
  url: 'https://agent.example.com',
  zoneId: 'zone1',
  clientId: 'zone1:agent-a',
  subjectToken: 'subject-token',
  agentSessionId: 'agent-session-1',
}

describe('CustomPipelineAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tool-token', expires_in: 900 }),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs pipeline steps in order with adapter context', async () => {
    const adapter = new CustomPipelineAdapter(config, 'https://sts.example.com', [
      (input) => ({ ...(input as Record<string, unknown>), first: true }),
      async (input, ctx) => ({ ...(input as Record<string, unknown>), token: await ctx.tool('resource://tool') }),
    ])

    await expect(adapter.run({ requestId: 'req-1', method: 'run', params: { value: 1 } })).resolves.toEqual({
      requestId: 'req-1',
      result: { value: 1, first: true, token: 'tool-token' },
    })
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('agent_session_id')).toBe('agent-session-1')
  })
})
