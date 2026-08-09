// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the console diagnostics trust boundary: internal topology never reaches the browser.

import { describe, expect, it } from 'vitest'

import { redactDiagnostics } from '../../../../apps/auth/src/diagnostics.ts'

function report(checks: { section: string; check: string; status: string; detail: string; advice?: string }[]) {
  return {
    command: 'doctor' as const,
    mode: 'system' as const,
    ready: true,
    strict: false,
    context: { apiUrl: 'http://api:3000', zoneScope: 'all' as const, zoneIds: ['z1'] },
    summary: { ok: checks.length, warn: 0, fail: 0, total: checks.length },
    checks,
  } as never
}

describe('redactDiagnostics', () => {
  it('replaces a successful probe URL detail with a plain status', () => {
    const redacted = redactDiagnostics(
      report([{ section: 'readiness', check: 'sts readiness', status: 'ok', detail: 'http://sts:8080/ready' }]),
    )
    expect(redacted.checks[0].detail).toBe('reachable')
  })

  it('redacts URLs embedded in failure details and advice', () => {
    const redacted = redactDiagnostics(
      report([
        {
          section: 'readiness',
          check: 'gateway readiness',
          status: 'fail',
          detail: 'HTTP 503 from http://gateway:8081/ready',
          advice: 'Inspect gateway logs and confirm the service is bound to http://gateway:8081.',
        },
      ]),
    )
    expect(redacted.checks[0].detail).toBe('HTTP 503 from [internal endpoint]')
    expect(redacted.checks[0].advice).toBe('Inspect gateway logs and confirm the service is bound to [internal endpoint]')
    expect(JSON.stringify(redacted)).not.toMatch(/gateway:8081|:\/\/gateway/)
  })

  it('drops the control-plane URL from the report context but keeps zone scope', () => {
    const redacted = redactDiagnostics(report([]))
    expect(redacted.context).toEqual({ zoneScope: 'all', zoneIds: ['z1'] })
    expect(JSON.stringify(redacted)).not.toContain('api:3000')
  })

  it('leaves topology-free details untouched', () => {
    const redacted = redactDiagnostics(
      report([
        { section: 'zones', check: 'zone inventory', status: 'ok', detail: '3 zones' },
        { section: 'readiness', check: 'audit metrics', status: 'warn', detail: 'consumer lag 69', advice: 'Check the audit write path.' },
      ]),
    )
    expect(redacted.checks[0].detail).toBe('3 zones')
    expect(redacted.checks[1].detail).toBe('consumer lag 69')
    expect(redacted.checks[1].advice).toBe('Check the audit write path.')
  })

  it('never emits an http or https URL anywhere in the report', () => {
    const redacted = redactDiagnostics(
      report([
        { section: 'health', check: 'api health', status: 'ok', detail: 'http://127.0.0.1:3000/health' },
        {
          section: 'readiness',
          check: 'coordinator readiness',
          status: 'fail',
          detail: 'connect ECONNREFUSED http://coordinator:4000/ready',
        },
      ]),
    )
    expect(JSON.stringify(redacted)).not.toMatch(/https?:\/\//)
  })
})
