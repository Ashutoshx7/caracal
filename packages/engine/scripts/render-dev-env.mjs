#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CI guard that renders infra/docker/dev.env from the schema and fails when the committed file drifts.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderDevEnv, devEnvRelativePath } from '../dist/envRender.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const target = resolve(repoRoot, devEnvRelativePath())
const rendered = renderDevEnv()
const check = process.argv.includes('--check')

const existing = existsSync(target) ? readFileSync(target, 'utf8') : null

if (check) {
  if (existing !== rendered) {
    process.stderr.write(`drift detected: ${target}\nrun \`node packages/engine/scripts/render-dev-env.mjs\` to refresh.\n`)
    process.exit(1)
  }
  process.stdout.write(`ok: ${target} matches schema\n`)
  process.exit(0)
}

if (existing !== rendered) {
  writeFileSync(target, rendered, { mode: 0o644 })
  process.stdout.write(`wrote ${target}\n`)
} else {
  process.stdout.write(`unchanged: ${target}\n`)
}
