// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal doctor` reports local control-plane readiness for a protected resource.

import type { CliConfig } from '../config.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  showHelp,
} from './shared.ts'

interface DoctorCheck {
  check: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function runCheck(checks: DoctorCheck[], name: string, fn: () => Promise<string>): Promise<void> {
  try {
    checks.push({ check: name, status: 'ok', detail: await fn() })
  } catch (err) {
    checks.push({ check: name, status: 'fail', detail: message(err) })
  }
}

export async function doctorCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') return help()
  const { flags } = parseArgs(argv)
  const json = flagBool(flags, 'json')
  try {
    const ctx = buildAdminClient(cfg)
    const { client } = ctx
    const zoneId = flagString(flags, 'zone') ?? ctx.zoneId
    const checks: DoctorCheck[] = []

    await runCheck(checks, 'api health', async () => {
      const res = await fetch(`${ctx.apiUrl.replace(/\/$/, '')}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ctx.apiUrl
    })
    await runCheck(checks, 'admin auth', async () => {
      const zones = await client.zones.list()
      return `${zones.length} zone(s) visible`
    })

    if (!zoneId) {
      checks.push({ check: 'zone', status: 'warn', detail: 'no zone selected; pass --zone or set CARACAL_ZONE_ID' })
    } else {
      await runCheck(checks, 'zone', async () => {
        const zone = await client.zones.get(zoneId)
        return `${zone.id} (${zone.name})`
      })
      await runCheck(checks, 'resources', async () => {
        const rows = await client.resources.list(zoneId)
        return rows.length === 0 ? 'none registered' : `${rows.length} registered`
      })
      await runCheck(checks, 'policy sets', async () => {
        const rows = await client.policySets.list(zoneId)
        const active = rows.filter((row) => row.active_version_id).length
        return active === 0 ? `${rows.length} registered; none active` : `${active} active`
      })
      await runCheck(checks, 'grants', async () => {
        const rows = await client.grants.list(zoneId)
        return rows.length === 0 ? 'none active' : `${rows.length} visible`
      })
      await runCheck(checks, 'audit query', async () => {
        await client.audit.list(zoneId, { limit: 1 })
        return 'queryable'
      })
    }

    if (json) return printJSON(checks)
    return printTable(checks, ['check', 'status', 'detail'])
  } catch (err) {
    fail(err)
  }
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal doctor [--zone <id>] [--json]',
      '',
      'Checks local control-plane readiness: API health, admin auth, selected zone, resources, policy sets, grants, and audit queryability.',
      '',
      'Flags:',
      '  --zone <id>             Zone selector (or CARACAL_ZONE_ID)',
      '  --json                  Emit machine-readable output',
      '  --help, -h              Show this help',
      '',
    ],
  )
}
