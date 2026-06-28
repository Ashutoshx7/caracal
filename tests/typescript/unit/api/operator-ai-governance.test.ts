// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Operator AI governance limits and the output-token ceiling middleware.

import { describe, it, expect } from 'vitest'
import {
  buildGovernanceLimits,
  defaultGovernanceLimits,
  buildGovernanceMiddleware,
} from '../../../../apps/api/src/operator-ai-governance.js'

// A minimal call-options object the middleware transforms; only maxOutputTokens matters here, so
// the prompt is structurally satisfied and cast rather than depending on the provider package.
function params(maxOutputTokens?: number) {
  return { prompt: [], maxOutputTokens }
}

async function transform(limit: number, requested?: number): Promise<number | undefined> {
  const middleware = buildGovernanceMiddleware({ maxOutputTokens: limit, maxCallsPerTurn: 0 })
  const out = await middleware.transformParams!({
    type: 'generate',
    params: params(requested) as never,
    model: {} as never,
  })
  return out.maxOutputTokens
}

describe('buildGovernanceLimits', () => {
  it('falls back to the safe defaults when nothing is configured', () => {
    expect(buildGovernanceLimits()).toEqual(defaultGovernanceLimits())
  })

  it('clamps negative and fractional values to safe integers', () => {
    expect(buildGovernanceLimits({ maxOutputTokens: -5, maxCallsPerTurn: 3.9 })).toEqual({ maxOutputTokens: 0, maxCallsPerTurn: 3 })
  })

  it('preserves an explicit zero as a lifted bound', () => {
    expect(buildGovernanceLimits({ maxOutputTokens: 0, maxCallsPerTurn: 0 })).toEqual({ maxOutputTokens: 0, maxCallsPerTurn: 0 })
  })
})

describe('buildGovernanceMiddleware', () => {
  it('clamps a request above the ceiling down to it', async () => {
    expect(await transform(1000, 5000)).toBe(1000)
  })

  it('leaves a request below the ceiling unchanged', async () => {
    expect(await transform(1000, 200)).toBe(200)
  })

  it('sets the ceiling when a call left the output open', async () => {
    expect(await transform(1000, undefined)).toBe(1000)
  })

  it('does not touch the parameters when the ceiling is disabled', async () => {
    expect(await transform(0, 5000)).toBe(5000)
    expect(await transform(0, undefined)).toBeUndefined()
  })
})
