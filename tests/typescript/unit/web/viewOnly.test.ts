// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests verifying that system-zone classification matches the control plane's reserved namespace.

import { describe, it, expect } from 'vitest'
import { isSystemZone } from '../../../../apps/web/src/platform/state/zones'

describe('isSystemZone', () => {
  it('matches the reserved system-zone slug prefix', () => {
    expect(isSystemZone({ slug: 'caracal-sys-operator', name: 'Operator' })).toBe(true)
  })

  it('matches the reserved system-zone name prefix', () => {
    expect(isSystemZone({ slug: 'ops', name: 'caracal.sys/operator' })).toBe(true)
  })

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(isSystemZone({ slug: '  CARACAL-SYS-Core ', name: '' })).toBe(true)
    expect(isSystemZone({ slug: '', name: ' Caracal.Sys/Core ' })).toBe(true)
  })

  it('does not match an ordinary tenant zone', () => {
    expect(isSystemZone({ slug: 'finance', name: 'Finance' })).toBe(false)
    expect(isSystemZone({ slug: 'my-caracal-sys', name: 'caracal sys' })).toBe(false)
  })

  it('treats a missing zone as not a system zone', () => {
    expect(isSystemZone(null)).toBe(false)
    expect(isSystemZone(undefined)).toBe(false)
  })
})
