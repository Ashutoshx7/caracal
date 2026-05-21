// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Persisted lifecycle state for the optional Control automation surface.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runtimePaths } from './runtime.js'

const STATE_FILE = 'control.json'
const CONTROL_DIR = 'control'
const CONTROL_GATE_FILE = 'enabled'
const DEFAULT_CONTROL_PORT = 8087
const CONTROL_SERVICE = 'control'
const CONTROL_PROFILE = 'control'

export interface ControlRuntimeSettings {
  service: typeof CONTROL_SERVICE
  profile: typeof CONTROL_PROFILE
  port: number
  endpoint: string
  healthUrl: string
  readyUrl: string
  invokeUrl: string
  bind: '127.0.0.1'
}

export interface ControlRuntimeState extends ControlRuntimeSettings {
  mounted: true
  enabled: boolean
  mountedAt?: string
  managedBy: 'engine'
  updatedAt: string
}

export interface ControlStateOptions {
  home?: string
  port?: number
}

function controlPort(port?: number): number {
  const value = port ?? Number(process.env.CONTROL_PORT ?? DEFAULT_CONTROL_PORT)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`CONTROL_PORT must be an integer between 1 and 65535 (got ${String(process.env.CONTROL_PORT ?? port)})`)
  }
  return value
}

export function controlStateFile(home: string = runtimePaths().home): string {
  return join(home, STATE_FILE)
}

export function controlGateDir(home: string = runtimePaths().home): string {
  return join(home, CONTROL_DIR)
}

export function controlGateFile(home: string = runtimePaths().home): string {
  return join(controlGateDir(home), CONTROL_GATE_FILE)
}

export function ensureControlGateDir(home?: string): string {
  const dir = controlGateDir(home)
  mkdirSync(dir, { recursive: true })
  return dir
}

function setControlGate(value: boolean, home?: string): void {
  const file = controlGateFile(home)
  if (value) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, 'enabled\n', { mode: 0o600 })
    return
  }
  if (existsSync(file)) rmSync(file, { force: true })
}

export function controlRuntimeSettings(opts: ControlStateOptions = {}): ControlRuntimeSettings {
  const port = controlPort(opts.port)
  const endpoint = `http://localhost:${port}`
  return {
    service: CONTROL_SERVICE,
    profile: CONTROL_PROFILE,
    port,
    endpoint,
    healthUrl: `${endpoint}/health`,
    readyUrl: `${endpoint}/ready`,
    invokeUrl: `${endpoint}/v1/control/invoke`,
    bind: '127.0.0.1',
  }
}

function baseStateValid(state: Partial<ControlRuntimeState>): boolean {
  return (
    state.managedBy === 'engine' &&
    state.service === CONTROL_SERVICE &&
    state.profile === CONTROL_PROFILE &&
    typeof state.port === 'number' &&
    typeof state.endpoint === 'string' &&
    typeof state.healthUrl === 'string' &&
    typeof state.readyUrl === 'string' &&
    typeof state.invokeUrl === 'string' &&
    state.bind === '127.0.0.1' &&
    typeof state.updatedAt === 'string'
  )
}

function validateControlState(raw: unknown, file: string): ControlRuntimeState {
  if (!raw || typeof raw !== 'object') throw new Error(`invalid Control state in ${file}`)
  const state = raw as Partial<ControlRuntimeState>
  if (
    !baseStateValid(state) ||
    state.mounted !== true ||
    typeof state.enabled !== 'boolean'
  ) {
    throw new Error(`invalid Control state in ${file}`)
  }
  controlPort(state.port)
  return state as ControlRuntimeState
}

function migrateControlState(raw: unknown, file: string): ControlRuntimeState {
  if (!raw || typeof raw !== 'object') throw new Error(`invalid Control state in ${file}`)
  const state = raw as Partial<ControlRuntimeState>
  if (baseStateValid(state) && state.mounted === undefined && typeof state.enabled === 'boolean') {
    const migrated = { ...state, mounted: true } as ControlRuntimeState
    controlPort(migrated.port)
    writeControlState(file, migrated)
    return migrated
  }
  return validateControlState(raw, file)
}

function readControlJson(file: string): unknown {
  const text = readFileSync(file, 'utf8').trim()
  if (text.length === 0) throw new Error(`invalid Control state in ${file}`)
  try {
    return JSON.parse(text)
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(`invalid Control state in ${file}`)
    throw err
  }
}

function loadControlState(file: string): ControlRuntimeState {
  const raw = readControlJson(file)
  const state = raw as Partial<ControlRuntimeState>
  if (state.mounted === undefined) return migrateControlState(raw, file)
  const current = validateControlState(raw, file)
  controlPort(current.port)
  return current
}

function writeControlState(file: string, state: ControlRuntimeState): void {
  controlPort(state.port)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
}

export function readControlState(home?: string): ControlRuntimeState | undefined {
  const file = controlStateFile(home)
  if (!existsSync(file)) return undefined
  return loadControlState(file)
}

export function isControlEnabled(home?: string): boolean {
  return readControlState(home)?.enabled === true
}

export function isControlMounted(home?: string): boolean {
  return readControlState(home)?.mounted === true
}

export function setControlMounted(value: boolean, enabled: boolean, opts: ControlStateOptions = {}): ControlRuntimeState | undefined {
  const file = controlStateFile(opts.home)
  if (value) {
    const at = new Date().toISOString()
    const state: ControlRuntimeState = {
      mounted: true,
      enabled,
      mountedAt: at,
      managedBy: 'engine',
      updatedAt: at,
      ...controlRuntimeSettings(opts),
    }
    writeControlState(file, state)
    setControlGate(enabled, opts.home)
    return state
  }
  setControlGate(false, opts.home)
  if (existsSync(file)) rmSync(file, { force: true })
  return undefined
}

export function setControlEnabled(value: boolean, opts: ControlStateOptions = {}): ControlRuntimeState | undefined {
  const file = controlStateFile(opts.home)
  const current = existsSync(file) ? loadControlState(file) : undefined
  if (!current) return undefined
  const state: ControlRuntimeState = {
    ...current,
    enabled: value,
    mountedAt: current.mountedAt ?? current.updatedAt,
    updatedAt: new Date().toISOString(),
  }
  writeControlState(file, state)
  setControlGate(value, opts.home)
  return state
}
