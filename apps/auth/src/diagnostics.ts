// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The diagnostics trust boundary: redacts internal service topology from doctor reports before they reach a browser.

import type { DoctorReport } from '@caracalai/engine'

// The doctor engine reports for a host-side operator, where probed URLs are the
// most useful diagnostic detail. A browser is on the other side of the trust
// boundary: service topology (container hostnames, loopback ports) must not
// cross it, so the report is reduced to service names and statuses here.
const INTERNAL_URL_PATTERN = /https?:\/\/[^\s,;"')]+/g

function redactTopology(text: string): string {
  return text.replace(INTERNAL_URL_PATTERN, '[internal endpoint]')
}

export type RedactedDiagnostics = Omit<DoctorReport, 'context'> & { context: Omit<DoctorReport['context'], 'apiUrl'> }

export function redactDiagnostics(report: DoctorReport): RedactedDiagnostics {
  const { apiUrl: _apiUrl, ...context } = report.context
  return {
    ...report,
    context,
    checks: report.checks.map((check) => {
      const bare = check.detail.trim()
      // A successful probe reports the URL it hit as its whole detail; the
      // browser-facing fact is simply that the service answered.
      const detail = check.status === 'ok' && /^https?:\/\/\S+$/.test(bare) ? 'reachable' : redactTopology(check.detail)
      return {
        ...check,
        detail,
        ...(check.advice === undefined ? {} : { advice: redactTopology(check.advice) }),
      }
    }),
  }
}
