// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Gate-file state for the in-process Control surface served by the API.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runtimePaths } from './runtime.js'

const CONTROL_DIR = 'control'
const CONTROL_GATE_FILE = 'enabled'
const DEFAULT_API_PORT = 3000

export interface ControlRuntimeSettings {
  port: number
  endpoint: string
  healthUrl: string
  readyUrl: string
  invokeUrl: string
  bind: '127.0.0.1'
}

export interface ControlStateOptions {
  home?: string
  port?: number
}

function controlPort(port?: number): number {
  const value = port ?? Number(process.env.API_PORT ?? DEFAULT_API_PORT)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`API_PORT must be an integer between 1 and 65535 (got ${String(process.env.API_PORT ?? port)})`)
  }
  return value
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

export function controlRuntimeSettings(opts: ControlStateOptions = {}): ControlRuntimeSettings {
  const port = controlPort(opts.port)
  const endpoint = `http://localhost:${port}`
  return {
    port,
    endpoint,
    healthUrl: `${endpoint}/health`,
    readyUrl: `${endpoint}/ready`,
    invokeUrl: `${endpoint}/v1/control/invoke`,
    bind: '127.0.0.1',
  }
}

export function isControlEnabled(home?: string): boolean {
  return existsSync(controlGateFile(home))
}

export function setControlEnabled(value: boolean, opts: ControlStateOptions = {}): ControlRuntimeSettings {
  const file = controlGateFile(opts.home)
  if (value) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, 'enabled\n', { mode: 0o600 })
  } else if (existsSync(file)) {
    rmSync(file, { force: true })
  }
  return controlRuntimeSettings(opts)
}
