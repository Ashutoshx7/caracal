// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Console info page tests for field-specific operational copy.

import { describe, expect, it } from 'vitest'
import { fieldInfo } from '../../../../apps/console/src/views/info.ts'

describe('fieldInfo', () => {
  it('describes OAuth authorization endpoints as URLs', () => {
    const info = fieldInfo('authorization endpoint', 'text', 'HTTPS endpoint where users approve delegated access', {
      required: true,
      dependency: 'Shown when kind is oauth2_authorization_code.',
    })

    expect(info.example).toBe('https://login.hooli.example/oauth/authorize')
    expect(info.valid).toContain('Absolute HTTPS URL')
    expect(info.after).toContain('provider consent page')
    expect(info.impact).toContain('OAuth browser authorization redirects')
  })

  it('describes OAuth token endpoints as HTTPS token URLs', () => {
    const info = fieldInfo('token endpoint', 'text', 'HTTPS endpoint where provider tokens are issued or refreshed', {
      required: true,
    })

    expect(info.example).toBe('https://login.hooli.example/oauth/token')
    expect(info.valid).toContain('Absolute HTTPS URL')
    expect(info.after).toContain('exchange or refresh provider tokens')
  })
})
