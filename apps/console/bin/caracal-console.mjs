#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Caracal Console launcher: stamps the dev identity when running from the repo, then defers to the TypeScript entry under Node 24 native type stripping.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stampScript = resolve(here, '..', 'scripts', 'stampDev.mjs')
const repoRoot = process.env.CARACAL_REPO_ROOT

if (repoRoot && existsSync(stampScript) && existsSync(join(repoRoot, '.git'))) {
  try {
    const sha = execFileSync(process.execPath, [stampScript], { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
    process.env.CARACAL_DEV_SHA = sha
  } catch (err) {
    process.stderr.write(`caracal-console: failed to stamp dev version: ${err?.message ?? err}\n`)
    process.exit(1)
  }
}

import('../src/index.ts').catch((err) => {
  process.stderr.write(`caracal-console: ${err?.message ?? err}\n`)
  process.exit(1)
})
