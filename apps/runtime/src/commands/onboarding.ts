// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Runtime onboarding writes caracal.toml after a local stack starts.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  buildAdminClient,
  generateClientSecret,
  type AdminContext,
} from '@caracalai/engine'
import {
  DEFAULT_ZONE_URL,
  defaultRuntimeConfigPath,
  resolveRuntimeConfigPath,
  type RuntimeConfig,
} from '@caracalai/engine/runtime-config'
import { printInfo } from '../style.ts'

const APP_NAME = 'Caracal local runner'
const ZONE_NAME = 'Local Dev'
const ZONE_SLUG = 'local-dev'
const POLL_MS = 1000
const TIMEOUT_MS = 120_000

interface RuntimeZone {
  id: string
}

interface RuntimeApplication {
  id: string
}

function configTargetPath(): string {
  return process.env.CARACAL_CONFIG && process.env.CARACAL_CONFIG.length > 0
    ? process.env.CARACAL_CONFIG
    : defaultRuntimeConfigPath()
}

function tomlString(value: string): string {
  return JSON.stringify(value)
}

function renderConfig(cfg: RuntimeConfig): string {
  return [
    `zone_url = ${tomlString(cfg.zone_url)}`,
    `zone_id = ${tomlString(cfg.zone_id)}`,
    `application_id = ${tomlString(cfg.application_id)}`,
    `app_client_secret = ${tomlString(cfg.app_client_secret)}`,
    '',
  ].join('\n')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function zonesWhenReady(ctx: AdminContext): Promise<RuntimeZone[]> {
  const deadline = Date.now() + TIMEOUT_MS
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      return await ctx.client.zones.list()
    } catch (err) {
      lastErr = err
      await delay(POLL_MS)
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'timed out')
  throw new Error(`admin API did not become ready for runtime config onboarding: ${reason}`)
}

async function runtimeZone(ctx: AdminContext, zones: RuntimeZone[]): Promise<RuntimeZone> {
  if (ctx.zoneId) return ctx.client.zones.get(ctx.zoneId)
  const existing = zones[0]
  if (existing) return existing
  return ctx.client.zones.create({ name: ZONE_NAME, slug: ZONE_SLUG })
}

async function runtimeApplication(ctx: AdminContext, zoneId: string, clientSecret: string): Promise<RuntimeApplication> {
  const apps = await ctx.client.applications.list(zoneId)
  const existing = apps.find((app) => app.name === APP_NAME)
  if (existing) {
    return ctx.client.applications.patch(zoneId, existing.id, {
      credential_type: 'token',
      client_secret: clientSecret,
      traits: ['runner', 'local'],
      consent: false,
    })
  }
  return ctx.client.applications.create(zoneId, {
    name: APP_NAME,
    registration_method: 'managed',
    credential_type: 'token',
    client_secret: clientSecret,
    traits: ['runner', 'local'],
    consent: false,
  })
}

export async function ensureRuntimeConfig(): Promise<void> {
  if (resolveRuntimeConfigPath()) return

  const ctx = buildAdminClient()
  const zones = await zonesWhenReady(ctx)
  const zone = await runtimeZone(ctx, zones)
  const clientSecret = generateClientSecret()
  const app = await runtimeApplication(ctx, zone.id, clientSecret)
  const path = configTargetPath()
  const cfg: RuntimeConfig = {
    zone_url: process.env.CARACAL_STS_URL ?? DEFAULT_ZONE_URL,
    zone_id: zone.id,
    application_id: app.id,
    app_client_secret: clientSecret,
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, renderConfig(cfg), { mode: 0o600 })
  printInfo(`wrote runtime config ${path}`)
}
