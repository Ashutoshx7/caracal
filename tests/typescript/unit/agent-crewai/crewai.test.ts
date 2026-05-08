// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CrewAI adapter unit tests for task delegation.

import { describe, expect, it, vi } from 'vitest'
import type { AgentServiceConfig } from '../../../../packages/agent-core/ts/src/types.js'
import { CrewAIAdapter } from '../../../../packages/framework-adaptor/agent-crewai/ts/src/crewai.js'

const config: AgentServiceConfig = {
  id: 'agent-a',
  url: 'https://agent.example.com',
  zoneId: 'zone1',
  clientId: 'zone1:agent-a',
  subjectToken: 'subject-token',
  agentSessionId: 'agent-session-1',
}

describe('CrewAIAdapter', () => {
  it('requires a task before running', async () => {
    const adapter = new CrewAIAdapter(config, 'https://sts.example.com')

    await expect(adapter.run({ value: 1 })).rejects.toThrow('CrewAI task is required')
  })

  it('delegates execution to the task', async () => {
    const task = { execute: vi.fn().mockResolvedValue({ result: 'ok' }) }
    const adapter = new CrewAIAdapter(config, 'https://sts.example.com', task)

    await expect(adapter.run({ value: 1 })).resolves.toEqual({ result: 'ok' })
    expect(task.execute).toHaveBeenCalledWith({ value: 1 })
  })
})
