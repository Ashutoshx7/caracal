// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CLI credential command unit tests for one-shot token exchange behavior.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { credentialInspectCommand, credentialReadCommand } from '../../../../apps/cli/src/commands/credential.js'
import type { CliConfig } from '../../../../apps/cli/src/config.js'

const cfg: CliConfig = {
  zone_url: 'https://sts.example.com',
  zone_id: 'zone1',
  application_id: 'app1',
  app_client_secret: 'secret',
}

describe('credentialReadCommand', () => {
  let stdout = ''
  let stderr = ''

  beforeEach(() => {
    stdout = ''
    stderr = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString()
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += chunk.toString()
      return true
    })
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints a resource token from STS', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'resource-token', expires_in: 900 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await credentialReadCommand('resource://api', cfg)

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(fetchMock.mock.calls[0][0]).toBe('https://sts.example.com/oauth/2/token')
    expect(body.get('zone_id')).toBe('zone1')
    expect(body.get('application_id')).toBe('app1')
    expect(body.get('client_secret')).toBe('secret')
    expect(body.get('resource')).toBe('resource://api')
    expect(body.get('ttl_seconds')).toBe('900')
    expect(stdout).toBe('resource-token\n')
  })

  it('exits with usage when resource is missing', async () => {
    await expect(credentialReadCommand('', cfg)).rejects.toThrow('exit:1')

    expect(stderr).toContain('Usage: caracal credential read <resource>')
  })

  it('inspects a JWT locally without contacting STS', () => {
    const token = [
      Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'kid-1', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({
        iss: 'https://sts.example.com',
        sub: 'app1',
        aud: ['resource://api'],
        zone_id: 'zone1',
        sid: 'sid-1',
        agent_session_id: 'agent-1',
        delegation_edge_id: 'edge-1',
        scope: 'api:read api:write',
        target: ['resource://api'],
        exp: 4102444800,
        iat: 1767225600,
        jti: 'jti-1',
      })).toString('base64url'),
      'signature',
    ].join('.')

    credentialInspectCommand([token, '--json'])

    const body = JSON.parse(stdout)
    expect(body).toMatchObject({
      verified: false,
      summary: {
        verification: 'not_verified',
        status: 'active',
        zone: 'zone1',
        session: 'sid-1',
        agent_run: 'agent-1',
        delegated_permission: 'edge-1',
        scopes: 'api:read api:write',
        resource: 'resource://api',
        algorithm: 'ES256',
        key_id: 'kid-1',
      },
      header: { kid: 'kid-1' },
      claims: { jti: 'jti-1' },
    })
  })
})
