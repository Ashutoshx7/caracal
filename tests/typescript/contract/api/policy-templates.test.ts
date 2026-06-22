// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Policy template contract tests for data-document compatibility with the platform decision contract.

import { describe, it, expect } from 'vitest'
import { policyTemplatesRoutes } from '../../../../apps/api/src/routes/policy-templates.js'
import { validateAuthzPolicy } from '../../../../apps/api/src/rego.js'
import { buildRouteApp } from '../../../shared/test-utils/typescript/fastify.js'

describe('policy template Rego contracts', () => {
  it('publishes data documents the platform decision contract consumes', async () => {
    const { app } = buildRouteApp(policyTemplatesRoutes)

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/policy-templates' })
    const templates = JSON.parse(res.body) as Array<{ id: string; content: string }>

    expect(templates.length).toBeGreaterThan(0)
    for (const template of templates) {
      expect(template.content).toContain('package caracal.authz')
      expect(template.content).toContain('# caracal:data-document')
      expect(template.content).not.toMatch(/result\s*:=/)
      expect(validateAuthzPolicy(template.content)).toBeNull()
    }
  })
})
