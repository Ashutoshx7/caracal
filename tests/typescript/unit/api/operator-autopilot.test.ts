// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Caracal-governed autopilot evaluator: policy construction fail-closed rules and the deterministic auto-approval triggers.

import { describe, it, expect } from 'vitest'
import {
  buildAutopilotPolicy,
  autopilotAvailable,
  mayAutoApprove,
  AUTOPILOT_DENIED_CAPABILITIES,
  type AutopilotPolicy,
  type AutopilotEvaluation,
} from '../../../../apps/api/src/operator-autopilot.js'
import type { PlanPreview } from '../../../../apps/api/src/operator-preview.js'

// A clean single-step preview for the given capability and effect, the shape the route hands the
// evaluator after previewing a plan against live state.
function previewFor(stepId: string, capability: string, effect: PlanPreview['steps'][number]['effect']): PlanPreview {
  return {
    ok: effect !== 'blocked',
    mutating: true,
    steps: [{ id: stepId, capability, title: capability, mutating: true, effect, detail: '' }],
    diagnostics: [],
  }
}

// A policy that permits one low-risk capability, the typical narrow allowlist a deployment sets.
function policyAllowing(...capabilities: string[]): AutopilotPolicy {
  return buildAutopilotPolicy({ enabled: true, capabilities, maxStepsPerPlan: 5, windowSec: 3600, windowMaxApprovals: 10 })
}

function evaluation(over: Partial<AutopilotEvaluation> = {}): AutopilotEvaluation {
  return {
    engaged: true,
    steps: [{ id: 's1', capability: 'registerApplication' }],
    preview: previewFor('s1', 'registerApplication', 'create'),
    advisory: undefined,
    recentAutoApprovals: 0,
    ...over,
  }
}

describe('buildAutopilotPolicy', () => {
  it('defaults to a disabled policy that approves nothing', () => {
    const policy = buildAutopilotPolicy()
    expect(policy.enabled).toBe(false)
    expect(policy.capabilities.size).toBe(0)
    expect(autopilotAvailable(policy)).toBe(false)
  })

  it('accepts a narrow allowlist of low-risk governed-executable capabilities', () => {
    const policy = buildAutopilotPolicy({ enabled: true, capabilities: ['registerApplication'] })
    expect(policy.capabilities.has('registerApplication')).toBe(true)
    expect(autopilotAvailable(policy)).toBe(true)
  })

  it('rejects an unknown capability', () => {
    expect(() => buildAutopilotPolicy({ capabilities: ['nope'] })).toThrow(/unknown capability/)
  })

  it('rejects a read-only capability that needs no approval', () => {
    expect(() => buildAutopilotPolicy({ capabilities: ['listApplications'] })).toThrow(/read-only/)
  })

  it('rejects a capability that is not governed-executable', () => {
    // createZone is mutating but has no in-zone control command, so it can never be auto-applied.
    expect(() => buildAutopilotPolicy({ capabilities: ['createZone'] })).toThrow(/not governed-executable/)
  })

  it('refuses to allowlist a denied high-risk capability', () => {
    for (const capability of AUTOPILOT_DENIED_CAPABILITIES) {
      expect(() => buildAutopilotPolicy({ enabled: true, capabilities: [capability] })).toThrow(/always requires human approval/)
    }
  })

  it('clamps numeric bounds to safe minimums', () => {
    const policy = buildAutopilotPolicy({ maxStepsPerPlan: 0, windowSec: -5, windowMaxApprovals: -1 })
    expect(policy.maxStepsPerPlan).toBe(1)
    expect(policy.windowSec).toBe(0)
    expect(policy.windowMaxApprovals).toBe(0)
  })
})

describe('mayAutoApprove', () => {
  it('approves a low-risk, allowlisted, cleanly-previewed plan', () => {
    expect(mayAutoApprove(evaluation(), policyAllowing('registerApplication'))).toEqual({ autoApprove: true })
  })

  it('stops when the master switch is off', () => {
    const policy = buildAutopilotPolicy({ enabled: false, capabilities: ['registerApplication'] })
    expect(mayAutoApprove(evaluation(), policy)).toEqual({ autoApprove: false, reason: 'autopilot_disabled' })
  })

  it('stops when the conversation has not engaged autopilot', () => {
    expect(mayAutoApprove(evaluation({ engaged: false }), policyAllowing('registerApplication'))).toEqual({
      autoApprove: false,
      reason: 'autopilot_not_engaged',
    })
  })

  it('stops on an empty plan', () => {
    expect(mayAutoApprove(evaluation({ steps: [], preview: { ok: true, mutating: false, steps: [], diagnostics: [] } }), policyAllowing('registerApplication'))).toEqual({
      autoApprove: false,
      reason: 'empty_plan',
    })
  })

  it('stops when the plan exceeds the per-plan step bound', () => {
    const policy = buildAutopilotPolicy({ enabled: true, capabilities: ['registerApplication'], maxStepsPerPlan: 1 })
    const steps = [
      { id: 's1', capability: 'registerApplication' },
      { id: 's2', capability: 'registerApplication' },
    ]
    const preview: PlanPreview = {
      ok: true,
      mutating: true,
      steps: steps.map((s) => ({ id: s.id, capability: s.capability, title: s.capability, mutating: true, effect: 'create' as const, detail: '' })),
      diagnostics: [],
    }
    expect(mayAutoApprove(evaluation({ steps, preview }), policy)).toEqual({ autoApprove: false, reason: 'exceeds_max_steps' })
  })

  it('stops when the rolling window budget is exhausted', () => {
    const policy = buildAutopilotPolicy({ enabled: true, capabilities: ['registerApplication'], windowMaxApprovals: 3 })
    expect(mayAutoApprove(evaluation({ recentAutoApprovals: 3 }), policy)).toEqual({ autoApprove: false, reason: 'window_budget_exhausted' })
  })

  it('stops when a capability is not on the allowlist', () => {
    // defineResource is governed-executable and mutating but not allowlisted here.
    const ev = evaluation({ steps: [{ id: 's1', capability: 'defineResource' }], preview: previewFor('s1', 'defineResource', 'create') })
    expect(mayAutoApprove(ev, policyAllowing('registerApplication'))).toEqual({ autoApprove: false, reason: 'capability_not_allowlisted' })
  })

  it('stops on a denied high-risk capability even if the evaluation reaches it', () => {
    // grantAccess can never be allowlisted, but the evaluator floors it regardless so a denied
    // capability is never auto-approved even if a policy were constructed another way.
    const policy: AutopilotPolicy = { enabled: true, capabilities: new Set(['grantAccess']), maxStepsPerPlan: 5, windowSec: 3600, windowMaxApprovals: 10 }
    const ev = evaluation({ steps: [{ id: 's1', capability: 'grantAccess' }], preview: previewFor('s1', 'grantAccess', 'create') })
    expect(mayAutoApprove(ev, policy)).toEqual({ autoApprove: false, reason: 'capability_requires_human' })
  })

  it('stops when the preview is not clean', () => {
    const blocked = evaluation({ preview: previewFor('s1', 'registerApplication', 'blocked') })
    expect(mayAutoApprove(blocked, policyAllowing('registerApplication'))).toEqual({ autoApprove: false, reason: 'preview_not_clean' })
    const exists = evaluation({ preview: previewFor('s1', 'registerApplication', 'exists') })
    expect(mayAutoApprove(exists, policyAllowing('registerApplication'))).toEqual({ autoApprove: false, reason: 'preview_not_clean' })
  })

  it('stops when a step has no matching preview entry', () => {
    const ev = evaluation({ preview: previewFor('other', 'registerApplication', 'create') })
    expect(mayAutoApprove(ev, policyAllowing('registerApplication'))).toEqual({ autoApprove: false, reason: 'preview_not_clean' })
  })

  it('stops when the advisory security review raises a warning', () => {
    const ev = evaluation({ advisory: { summary: 'broad', findings: [{ severity: 'warning', concern: 'over-grant' }] } })
    expect(mayAutoApprove(ev, policyAllowing('registerApplication'))).toEqual({ autoApprove: false, reason: 'security_warning' })
  })

  it('still approves when the advisory has only lower-severity findings', () => {
    const ev = evaluation({ advisory: { summary: 'fine', findings: [{ severity: 'caution', concern: 'double-check' }, { severity: 'info', concern: 'fyi' }] } })
    expect(mayAutoApprove(ev, policyAllowing('registerApplication'))).toEqual({ autoApprove: true })
  })

  it('allows a read-only effect step in an otherwise clean plan', () => {
    const ev = evaluation({ preview: previewFor('s1', 'registerApplication', 'read_only') })
    expect(mayAutoApprove(ev, policyAllowing('registerApplication'))).toEqual({ autoApprove: true })
  })
})
