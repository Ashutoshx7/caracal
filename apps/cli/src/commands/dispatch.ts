// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// PATH-based locator and executor for sibling Caracal binaries so the shell can dispatch to caracal-cli and caracal-tui without statically linking them.

import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { constants as osConstants } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { printError, printInfo } from '../style.ts'

const EXT = process.platform === 'win32' ? '.exe' : ''
const INSTALL_URL = 'https://github.com/Garudex-Labs/caracal/releases/latest/download/install.sh'
const INSTALL_HINTS = {
  cli: `Install the CLI:  curl -fsSL ${INSTALL_URL} | sh`,
  tui: `Add the TUI:      curl -fsSL ${INSTALL_URL} | sh -s -- --tui`,
  tuiOnly: `Or TUI only:      curl -fsSL ${INSTALL_URL} | sh -s -- --tui-only`,
} as const

const WORKSPACE_SHIMS: Record<string, string> = {
  'caracal-cli': 'apps/cli/bin/caracal-cli.mjs',
  'caracal-tui': 'apps/tui/bin/caracal-tui.mjs',
}

function workspaceShim(binName: string): { cmd: string; argvPrefix: string[] } | undefined {
  const root = process.env.CARACAL_REPO_ROOT
  if (!root) return undefined
  const rel = WORKSPACE_SHIMS[binName]
  if (!rel) return undefined
  const shim = join(root, rel)
  try { if (existsSync(shim) && statSync(shim).isFile()) return { cmd: process.execPath, argvPrefix: [shim] } } catch { /* ignore */ }
  return undefined
}

function searchDirs(): string[] {
  const dirs: string[] = []
  const path = process.env.PATH ?? ''
  for (const d of path.split(delimiter)) if (d) dirs.push(d)
  try {
    const here = dirname(process.execPath)
    if (here && !dirs.includes(here)) dirs.unshift(here)
  } catch { /* ignore */ }
  return dirs
}

function locate(binName: string): string | undefined {
  for (const dir of searchDirs()) {
    const candidate = join(dir, `${binName}${EXT}`)
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    } catch { /* ignore */ }
  }
  return undefined
}

interface MissingHints {
  readonly installLine: string
  readonly altLine?: string
}

export function execSibling(binName: string, argv: string[], hints: MissingHints): never {
  const shim = workspaceShim(binName)
  const cmd = shim?.cmd ?? locate(binName)
  if (!cmd) {
    printError(`'${binName}' is not installed.`)
    printInfo(hints.installLine)
    if (hints.altLine) printInfo(hints.altLine)
    process.exit(127)
  }
  const fullArgs = shim ? [...shim.argvPrefix, ...argv] : argv
  const result = spawnSync(cmd, fullArgs, {
    stdio: 'inherit',
    env: { ...process.env, CARACAL_INVOKED_AS: binName === 'caracal-cli' ? 'caracal cli' : 'caracal tui' },
  })
  if (result.error) {
    printError(`failed to launch ${binName}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.signal) {
    const signo = osConstants.signals[result.signal as keyof typeof osConstants.signals]
    process.exit(typeof signo === 'number' ? 128 + signo : 1)
  }
  process.exit(result.status ?? 0)
}

export function cliDispatch(argv: string[]): never {
  execSibling('caracal-cli', argv, { installLine: INSTALL_HINTS.cli, altLine: INSTALL_HINTS.tuiOnly })
}

export function tuiDispatch(argv: string[]): never {
  execSibling('caracal-tui', argv, { installLine: INSTALL_HINTS.tui, altLine: INSTALL_HINTS.tuiOnly })
}
