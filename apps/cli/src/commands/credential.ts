// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal credential …`: reads scoped resource tokens and inspects JWT claims.

import { readFileSync } from 'node:fs'
import { credentialInspect, credentialRead } from '@caracalai/engine'
import { scrubTokens } from '@caracalai/engine/crash'
import type { CliConfig } from '../config.ts'
import { printError } from '../style.ts'
import {
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  showHelp,
  unknownVerb,
} from './shared.ts'

export async function credentialCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  switch (verb) {
    case 'read':
      if (rest[0] === 'help' || rest[0] === '--help' || rest[0] === '-h') return readHelp()
      if (!cfg) {
        printError('caracal.toml not found; credential read needs zone_url, zone_id, application_id, and app_client_secret. Use `caracal credential inspect` for offline token inspection.')
        process.exit(1)
      }
      return credentialReadCommand(rest[0] ?? '', cfg)
    case 'inspect':
      return credentialInspectCommand(rest)
    case 'help':
    case '--help':
    case '-h':
      return help()
    default:
      return unknownVerb('credential', verb, help)
  }
}

export async function credentialReadCommand(resource: string, cfg: CliConfig): Promise<void> {
  if (!resource) {
    printError('Usage: caracal credential read <resource>')
    process.exit(1)
  }
  try {
    const token = await credentialRead({ cfg, resource })
    process.stdout.write(token + '\n')
  } catch (err) {
    const desc = scrubTokens(err instanceof Error ? err.message : String(err))
    process.stderr.write(JSON.stringify({ resource, reason: desc }) + '\n')
    const requestIdMatch = desc.match(/request_id=([\w-]+)/)
    if (requestIdMatch) {
      process.stderr.write(`  → caracal explain ${requestIdMatch[1]}\n`)
    }
    process.exit(1)
  }
}

export function credentialInspectCommand(argv: string[]): void {
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') return inspectHelp()
  const { positional, flags } = parseArgs(argv)
  const json = flagBool(flags, 'json')
  try {
    const inspection = credentialInspect(readToken(positional[0], flags))
    if (json) return printJSON(inspection)
    printTable([inspection.summary], [
      'verification',
      'status',
      'issuer',
      'subject',
      'zone',
      'session',
      'agent_run',
      'delegated_permission',
      'resource',
      'scopes',
      'expires_at',
      'seconds_until_expiry',
      'algorithm',
      'key_id',
      'token_id',
    ])
  } catch (err) {
    fail(err)
  }
}

function readToken(positional: string | undefined, flags: Record<string, string | boolean>): string {
  const flagToken = flagString(flags, 'token')
  const file = flagString(flags, 'file')
  const sources = [positional, flagToken, file].filter((value) => typeof value === 'string' && value !== '')
  if (sources.length > 1) {
    throw new Error('provide exactly one token source: positional token, --token, --file, or - for stdin')
  }
  if (file) return readFileSync(file, 'utf8').trim()
  const source = flagToken ?? positional
  if (source === '-') return readFileSync(0, 'utf8').trim()
  if (source) return source.trim()
  throw new Error('Usage: caracal credential inspect <jwt>|--token <jwt>|--file <path>|- [--json]')
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal credential <verb> [options]',
      '',
      'Verbs:',
      '  read <resource>       Exchange app credentials for a scoped Caracal access token',
      '  inspect <jwt>|-       Decode a JWT locally without verifying its signature',
      '',
      'See `caracal credential inspect --help` for token-inspection sources.',
      '',
    ],
  )
}

function readHelp(): never {
  return showHelp(
    [
      'Usage: caracal credential read <resource>',
      '',
      'Exchanges app credentials from caracal.toml for a scoped Caracal access token.',
      '',
    ],
  )
}

function inspectHelp(): never {
  return showHelp(
    [
      'Usage: caracal credential inspect <jwt>|--token <jwt>|--file <path>|- [--json]',
      '',
      'Decodes a JWT header and claims locally. The command does not verify the signature; use it to inspect issuer, subject, zone, scopes, resources, sessions, expiry, and key id during triage.',
      '',
      'Sources:',
      '  <jwt>                  Token as a positional argument',
      '  --token <jwt>          Token as a flag value',
      '  --file <path>          Read token from a file',
      '  -                      Read token from stdin',
      '',
      'Flags:',
      '  --json                 Emit decoded header, claims, and summary',
      '  --help, -h             Show this help',
      '',
    ],
  )
}
