#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Workspace entry: locates the repo root, stamps a dev TUI identity, then delegates to the workspace TUI.

import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

function findRepoRoot(start) {
  let dir = start
  while (true) {
    if (existsSync(join(dir, 'apps/tui/bin/caracal-tui.mjs'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const start = process.env.INIT_CWD || process.env.PWD || process.cwd()
const root = findRepoRoot(start)

if (!root) {
  process.stderr.write(
    'caracal-tui: this binary is the pnpm workspace shim and only runs inside the Caracal monorepo.\n' +
      'If you installed the released TUI, remove the pnpm symlink so the installed binary wins:\n' +
      '  pnpm rm -g caracal-tui   # or: rm "$(pnpm bin -g)/caracal-tui"\n',
  )
  process.exit(1)
}

process.env.CARACAL_REPO_ROOT = root

const engineDist = join(root, 'packages/engine/dist/index.js')
if (!existsSync(engineDist)) {
  process.stderr.write('caracal-tui: building @caracalai/engine (first run)…\n')
  try {
    execFileSync('pnpm', ['--filter', '@caracalai/engine', 'build'], {
      cwd: root,
      stdio: 'inherit',
    })
  } catch (err) {
    process.stderr.write(`caracal-tui: failed to build engine: ${err?.message ?? err}\n`)
    process.exit(1)
  }
}

try {
  const sha = execFileSync('node', [join(root, 'apps/tui/scripts/stampDev.mjs')], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
  process.env.CARACAL_DEV_SHA = sha
} catch (err) {
  process.stderr.write(`caracal-tui: failed to stamp dev version: ${err?.message ?? err}\n`)
  process.exit(1)
}

import(join(root, 'apps/tui/bin/caracal-tui.mjs')).catch((err) => {
  process.stderr.write(`caracal-tui: ${err?.message ?? err}\n`)
  process.exit(1)
})
