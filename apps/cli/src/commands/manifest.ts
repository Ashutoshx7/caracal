// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal manifest …` ecosystem extension manifest tooling.

import type { CliConfig } from '../config.ts'
import { printSuccess, printWarn } from '../style.ts'
import { fail, flagBool, flagString, parseArgs, printJSON, printTable, readContent, showHelp, unknownVerb, usage } from './shared.ts'

type JsonRecord = Record<string, unknown>
type ManifestKind =
  | 'gateway-upstream'
  | 'provider-credential-plugin'
  | 'audit-exporter'
  | 'policy-pack'
  | 'resource-verifier'
  | 'agent-connector'

interface ManifestResult {
  valid: boolean
  kind: ManifestKind
  schema_url: string
  name: string
  version: string
  errors: string[]
  warnings: string[]
}

const schemaBase = 'https://docs.caracal.run/schemas'
const schemaByKind: Record<ManifestKind, string> = {
  'gateway-upstream': `${schemaBase}/caracal-gateway-upstream-manifest-2026-05-21.schema.json`,
  'provider-credential-plugin': `${schemaBase}/caracal-provider-credential-plugin-manifest-2026-05-21.schema.json`,
  'audit-exporter': `${schemaBase}/caracal-audit-exporter-manifest-2026-05-21.schema.json`,
  'policy-pack': `${schemaBase}/caracal-policy-pack-manifest-2026-05-21.schema.json`,
  'resource-verifier': `${schemaBase}/caracal-resource-verifier-manifest-2026-05-21.schema.json`,
  'agent-connector': `${schemaBase}/caracal-agent-connector-manifest-2026-05-21.schema.json`,
}

export async function manifestCommand(argv: string[], _cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  const { flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')
  try {
    switch (verb) {
      case 'validate': {
        const file = flagString(flags, 'file')
        if (!file) return usage('manifest validate --file <manifest.json> [--kind gateway-upstream|provider-credential-plugin|audit-exporter|policy-pack|resource-verifier|agent-connector] [--json]')
        const result = validateManifest(readManifest(file), flagString(flags, 'kind') as ManifestKind | undefined)
        if (json) return printJSON(result)
        if (result.errors.length > 0) {
          printTable(result.errors.map((message) => ({ level: 'error', message })), ['level', 'message'])
          process.exit(1)
        }
        printSuccess(`valid ${result.kind} manifest: ${result.name}@${result.version}`)
        for (const warning of result.warnings) printWarn(warning)
        process.stdout.write(`schema: ${result.schema_url}\n`)
        return
      }
      case 'help':
      case '--help':
      case '-h':
        return help()
      default:
        return unknownVerb('manifest', verb, help)
    }
  } catch (err) {
    fail(err)
  }
}

function readManifest(file: string): JsonRecord {
  const value = JSON.parse(readContent(`@${file}`)) as unknown
  if (!isRecord(value)) throw new Error('manifest must be a JSON object')
  return value
}

function validateManifest(manifest: JsonRecord, requestedKind?: ManifestKind): ManifestResult {
  const errors: string[] = []
  const warnings: string[] = []
  const kind = requestedKind ?? detectKind(manifest)
  requireString(manifest, 'schema_version', errors)
  requireString(manifest, 'name', errors)
  requireString(manifest, 'version', errors)
  if (manifest.schema_version !== '2026-05-21') errors.push('schema_version must be 2026-05-21')
  switch (kind) {
    case 'gateway-upstream':
      validateGatewayUpstream(manifest, errors, warnings)
      break
    case 'provider-credential-plugin':
      validateProviderCredentialPlugin(manifest, errors)
      break
    case 'audit-exporter':
      validateAuditExporter(manifest, errors)
      break
    case 'policy-pack':
      validatePolicyPack(manifest, errors, warnings)
      break
    case 'resource-verifier':
      validateResourceVerifier(manifest, errors)
      break
    case 'agent-connector':
      validateAgentConnector(manifest, errors, warnings)
      break
  }
  return {
    valid: errors.length === 0,
    kind,
    schema_url: schemaByKind[kind],
    name: stringValue(manifest.name),
    version: stringValue(manifest.version),
    errors,
    warnings,
  }
}

function validateGatewayUpstream(manifest: JsonRecord, errors: string[], warnings: string[]): void {
  requireString(manifest, 'resource_identifier', errors)
  requireArray(manifest, 'protocols', errors)
  requireArray(manifest, 'auth_modes', errors)
  requireArray(manifest, 'scopes', errors)
  const audit = recordValue(manifest.audit)
  if (audit.action_result_required !== true) errors.push('audit.action_result_required must be true')
  if (!arrayValue(manifest.required_headers).includes('traceparent')) warnings.push('required_headers should include traceparent for W3C trace propagation')
  if (!arrayValue(manifest.required_headers).includes('baggage')) warnings.push('required_headers should include baggage for Caracal context propagation')
}

function validateProviderCredentialPlugin(manifest: JsonRecord, errors: string[]): void {
  requireArray(manifest, 'provider_kinds', errors)
  requireObject(manifest, 'config_schema', errors)
  requireObject(manifest, 'secret_schema', errors)
  const lifecycle = recordValue(manifest.lifecycle)
  const hooks = arrayValue(lifecycle.hooks)
  if (!hooks.includes('validate')) errors.push('lifecycle.hooks must include validate')
  if (!hooks.includes('resolve')) errors.push('lifecycle.hooks must include resolve')
  const execution = recordValue(manifest.execution)
  if (execution.credential_exposure !== 'gateway_only') errors.push('execution.credential_exposure must be gateway_only')
}

function validateAuditExporter(manifest: JsonRecord, errors: string[]): void {
  if (manifest.event_schema_version !== '2026-05-21') errors.push('event_schema_version must be 2026-05-21')
  requireArray(manifest, 'destinations', errors)
  const delivery = recordValue(manifest.delivery)
  if (delivery.retry !== 'at_least_once') errors.push('delivery.retry must be at_least_once')
  if (delivery.ordering !== 'ledger_order') errors.push('delivery.ordering must be ledger_order')
  const forbidden = arrayValue(recordValue(manifest.redaction).forbidden_fields)
  for (const field of ['authorization', 'provider_token', 'request_body', 'response_body']) {
    if (!forbidden.includes(field)) errors.push(`redaction.forbidden_fields must include ${field}`)
  }
}

function validatePolicyPack(manifest: JsonRecord, errors: string[], warnings: string[]): void {
  requireString(manifest, 'id', errors)
  if (manifest.policy_input_schema_version !== '2026-05-20') errors.push('policy_input_schema_version must be 2026-05-20')
  requireString(manifest, 'entrypoint', errors)
  requireArray(manifest, 'rego_modules', errors)
  requireArray(manifest, 'tests', errors)
  if (recordValue(manifest.signing).required !== true) warnings.push('signing.required should be true before publishing policy packs')
}

function validateResourceVerifier(manifest: JsonRecord, errors: string[]): void {
  requireArray(manifest, 'languages', errors)
  const claim = recordValue(manifest.claim_profile)
  if (claim.jwt_claim_schema_version !== '2026-05-21') errors.push('claim_profile.jwt_claim_schema_version must be 2026-05-21')
  for (const field of ['requires_audience', 'requires_target', 'requires_scope', 'requires_use_resource']) {
    if (claim[field] !== true) errors.push(`claim_profile.${field} must be true`)
  }
  const revocation = recordValue(manifest.revocation)
  if (revocation.supported !== true) errors.push('revocation.supported must be true')
  const anchors = arrayValue(revocation.anchors)
  for (const anchor of ['sid', 'root_sid', 'agent_session_id', 'delegation_edge_id']) {
    if (!anchors.includes(anchor)) errors.push(`revocation.anchors must include ${anchor}`)
  }
  if (recordValue(manifest.audit).action_result_emitter !== true) errors.push('audit.action_result_emitter must be true')
}

function validateAgentConnector(manifest: JsonRecord, errors: string[], warnings: string[]): void {
  requireString(manifest, 'framework', errors)
  const modes = arrayValue(manifest.enforcement_modes)
  if (!modes.includes('gateway_mediated') && !modes.includes('connector_verified')) errors.push('enforcement_modes must include gateway_mediated or connector_verified')
  if (modes.includes('attribution_only')) warnings.push('attribution_only connectors must not be advertised as production enforcement')
  const propagation = recordValue(manifest.context_propagation)
  for (const field of ['authorization', 'traceparent', 'baggage']) {
    if (propagation[field] !== true) errors.push(`context_propagation.${field} must be true`)
  }
  const audit = recordValue(manifest.audit)
  if (audit.emits_action_result !== true) errors.push('audit.emits_action_result must be true')
  if (audit.labels_enforcement_mode !== true) errors.push('audit.labels_enforcement_mode must be true')
}

function detectKind(manifest: JsonRecord): ManifestKind {
  if (Object.hasOwn(manifest, 'resource_identifier')) return 'gateway-upstream'
  if (Object.hasOwn(manifest, 'provider_kinds')) return 'provider-credential-plugin'
  if (Object.hasOwn(manifest, 'destinations')) return 'audit-exporter'
  if (Object.hasOwn(manifest, 'policy_input_schema_version')) return 'policy-pack'
  if (Object.hasOwn(manifest, 'claim_profile')) return 'resource-verifier'
  if (Object.hasOwn(manifest, 'framework')) return 'agent-connector'
  throw new Error('unable to detect manifest kind; pass --kind')
}

function requireString(manifest: JsonRecord, key: string, errors: string[]): void {
  if (typeof manifest[key] !== 'string' || manifest[key] === '') errors.push(`${key} must be a non-empty string`)
}

function requireArray(manifest: JsonRecord, key: string, errors: string[]): void {
  if (!Array.isArray(manifest[key]) || manifest[key].length === 0) errors.push(`${key} must be a non-empty array`)
}

function requireObject(manifest: JsonRecord, key: string, errors: string[]): void {
  if (!isRecord(manifest[key])) errors.push(`${key} must be an object`)
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {}
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function help(): never {
  return showHelp([
    'Usage: caracal manifest <verb> [options]',
    '',
    'Verbs:',
    '  validate --file <manifest.json>   Validate an interoperability extension manifest',
    '',
    'Options:',
    '  --kind <kind>                     Override kind detection',
    '  --json                            Emit machine-readable result',
    '',
    'Kinds:',
    '  gateway-upstream | provider-credential-plugin | audit-exporter | policy-pack | resource-verifier | agent-connector',
    '',
  ])
}
