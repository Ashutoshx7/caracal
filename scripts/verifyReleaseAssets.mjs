#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verifies release archive assets and checksums for a Caracal release tag.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const [releaseTag, dir = 'dist'] = process.argv.slice(2)

function fail(message) {
  process.stderr.write(`verifyReleaseAssets: ${message}\n`)
  process.exit(1)
}

if (!releaseTag || !/^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?(-rc\.(sha[0-9A-Za-z]+|[0-9]+))?$/.test(releaseTag)) {
  fail(`expected release tag argument, got ${releaseTag ?? '<empty>'}`)
}

const root = resolve(dir)
const assets = [
  `caracal-runtime-linux-amd64-${releaseTag}.tar.gz`,
  `caracal-runtime-linux-arm64-${releaseTag}.tar.gz`,
  `caracal-runtime-darwin-amd64-${releaseTag}.tar.gz`,
  `caracal-runtime-darwin-arm64-${releaseTag}.tar.gz`,
  `caracal-runtime-windows-amd64-${releaseTag}.zip`,
  'manifest.json',
  'SHA256SUMS',
]

for (const asset of assets) {
  const path = resolve(root, asset)
  if (!existsSync(path)) fail(`missing release asset: ${path}`)
}

execFileSync('sha256sum', ['--check', 'SHA256SUMS'], { cwd: root, stdio: 'inherit' })

process.stdout.write(`verified ${assets.length} release assets in ${basename(root)} for ${releaseTag}\n`)
