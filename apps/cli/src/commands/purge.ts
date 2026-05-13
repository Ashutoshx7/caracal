// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal purge`: centralized cleanup for selectable targets across dev and runtime installs.

import { spawn } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { resolveCliConfigPath } from '@caracalai/core/cli'
import { runtimePaths } from '../runtime/install.ts'
import { resolvePaths } from './stack.ts'
import { showHelp } from './shared.ts'

type TargetId = 'stack' | 'volumes' | 'logs' | 'config' | 'runtime' | 'cache'

interface Target {
  id: TargetId
  label: string
  describe: (ctx: PurgeContext) => string
  available: (ctx: PurgeContext) => boolean
  run: (ctx: PurgeContext) => Promise<void>
}

interface PurgeContext {
  mode: 'dev' | 'runtime'
  composeFile: string
  envFile: string
  cwd: string
  configPath: string | undefined
  runtimeHome: string
  repoRoot: string | undefined
  dryRun: boolean
}

function purgeHelp(): never {
  return showHelp(
    [
      'Usage: caracal purge [targets...] [options]',
      '',
      'Centralized cleanup for selectable resources. Without targets, prompts interactively.',
      '',
      'Targets:',
      '  stack       Stop and remove containers + network (compose down)',
      '  volumes     Remove data volumes — DESTROYS Postgres and Redis state',
      '  logs        Truncate container log files via `compose down` + recreate',
      '  config      Remove caracal.toml (zone client secret and config)',
      '  runtime     Remove runtime assets at $CARACAL_HOME (.env, compose.yml)',
      '  cache       Remove build artifacts: apps/*/dist, coverage/, node_modules/.cache (dev only)',
      '  all         All targets except `volumes` and `runtime` (use --include-destructive to add them)',
      '',
      'Options:',
      '  --yes, -y                Skip confirmation prompt',
      '  --dry-run                Show what would be removed without doing it',
      '  --include-destructive    With `all`, also wipe `volumes` and `runtime`',
      '  --help, -h               Show this help',
      '',
    ],
  )
}

function buildContext(dryRun: boolean): PurgeContext {
  const paths = resolvePaths()
  const runtime = runtimePaths()
  const configPath = resolveCliConfigPath()
  const repoRoot = paths.mode === 'dev' ? paths.cwd : undefined
  return {
    mode: paths.mode,
    composeFile: paths.composeFile,
    envFile: paths.envFile,
    cwd: paths.cwd,
    configPath,
    runtimeHome: runtime.home,
    repoRoot,
    dryRun,
  }
}

function runCompose(args: string[], ctx: PurgeContext): Promise<number> {
  return new Promise((resolveExit) => {
    if (ctx.dryRun) {
      process.stdout.write(`  [dry-run] docker compose ${args.join(' ')}\n`)
      return resolveExit(0)
    }
    const proc = spawn(
      'docker',
      ['compose', '--env-file', ctx.envFile, '-f', ctx.composeFile, ...args],
      { stdio: 'inherit', cwd: ctx.cwd },
    )
    proc.on('exit', (code) => resolveExit(typeof code === 'number' ? code : 1))
    proc.on('error', (err) => {
      process.stderr.write(`  ! docker compose failed: ${err.message}\n`)
      resolveExit(127)
    })
  })
}

function removePath(path: string, ctx: PurgeContext, label: string): void {
  if (!existsSync(path)) {
    process.stdout.write(`  (skip) ${label}: ${path} — not present\n`)
    return
  }
  if (ctx.dryRun) {
    process.stdout.write(`  [dry-run] remove ${label}: ${path}\n`)
    return
  }
  const isDir = statSync(path).isDirectory()
  rmSync(path, { recursive: isDir, force: true })
  process.stdout.write(`  removed ${label}: ${path}\n`)
}

const TARGETS: Target[] = [
  {
    id: 'stack',
    label: 'Stop & remove containers',
    describe: (ctx) => `compose down (${ctx.mode} stack)`,
    available: () => true,
    run: async (ctx) => {
      const code = await runCompose(['down'], ctx)
      if (code !== 0) throw new Error(`compose down exited ${code}`)
    },
  },
  {
    id: 'volumes',
    label: 'Remove data volumes (DESTRUCTIVE)',
    describe: () => 'compose down -v — wipes Postgres and Redis volumes',
    available: () => true,
    run: async (ctx) => {
      const code = await runCompose(['down', '-v'], ctx)
      if (code !== 0) throw new Error(`compose down -v exited ${code}`)
    },
  },
  {
    id: 'logs',
    label: 'Truncate container logs',
    describe: () => 'compose down (without -v) drops log files; restart with `caracal up`',
    available: () => true,
    run: async (ctx) => {
      const code = await runCompose(['down'], ctx)
      if (code !== 0) throw new Error(`compose down exited ${code}`)
    },
  },
  {
    id: 'config',
    label: 'Remove caracal.toml',
    describe: (ctx) => ctx.configPath ?? '(no caracal.toml found)',
    available: (ctx) => ctx.configPath !== undefined,
    run: async (ctx) => {
      if (ctx.configPath) removePath(ctx.configPath, ctx, 'config')
    },
  },
  {
    id: 'runtime',
    label: 'Remove runtime assets (DESTRUCTIVE)',
    describe: (ctx) => `${ctx.runtimeHome} — bundled compose.yml, .env, provision script`,
    available: (ctx) => existsSync(ctx.runtimeHome),
    run: async (ctx) => {
      removePath(ctx.runtimeHome, ctx, 'runtime')
    },
  },
  {
    id: 'cache',
    label: 'Remove build artifacts (dev only)',
    describe: (ctx) =>
      ctx.repoRoot ? `apps/*/dist, packages/*/dist, coverage/, node_modules/.cache` : '(dev mode only)',
    available: (ctx) => ctx.repoRoot !== undefined,
    run: async (ctx) => {
      if (!ctx.repoRoot) return
      const root = ctx.repoRoot
      for (const sub of ['coverage', 'node_modules/.cache', '.turbo']) {
        removePath(join(root, sub), ctx, sub)
      }
      for (const group of ['apps', 'packages']) {
        const base = join(root, group)
        if (!existsSync(base)) continue
        const { readdirSync, statSync } = await import('node:fs')
        for (const name of readdirSync(base)) {
          const child = join(base, name)
          try {
            if (!statSync(child).isDirectory()) continue
          } catch {
            continue
          }
          removePath(join(child, 'dist'), ctx, `${group}/${name}/dist`)
        }
      }
    },
  },
]

function targetById(id: string): Target | undefined {
  return TARGETS.find((t) => t.id === id)
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolveAnswer) => {
    rl.question(question, (answer) => {
      rl.close()
      resolveAnswer(answer.trim())
    })
  })
}

async function selectInteractively(ctx: PurgeContext): Promise<Target[]> {
  const usable = TARGETS.filter((t) => t.available(ctx))
  process.stdout.write('Select purge targets (comma-separated numbers, or "all"):\n')
  usable.forEach((t, i) => {
    process.stdout.write(`  ${i + 1}. ${t.label} — ${t.describe(ctx)}\n`)
  })
  const answer = await prompt('> ')
  if (answer === '' || answer.toLowerCase() === 'q') return []
  if (answer.toLowerCase() === 'all') {
    return usable.filter((t) => t.id !== 'volumes' && t.id !== 'runtime')
  }
  const picks = answer.split(',').map((s) => parseInt(s.trim(), 10))
  const selected: Target[] = []
  for (const n of picks) {
    if (!Number.isInteger(n) || n < 1 || n > usable.length) {
      process.stderr.write(`Error: invalid selection: ${n}\n`)
      process.exit(1)
    }
    selected.push(usable[n - 1]!)
  }
  return selected
}

function expandAll(includeDestructive: boolean): Target[] {
  if (includeDestructive) return [...TARGETS]
  return TARGETS.filter((t) => t.id !== 'volumes' && t.id !== 'runtime')
}

export async function purgeCommand(argv: string[]): Promise<void> {
  let yes = false
  let dryRun = false
  let includeDestructive = false
  const requested: string[] = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') purgeHelp()
    else if (arg === '--yes' || arg === '-y') yes = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--include-destructive') includeDestructive = true
    else if (arg.startsWith('--')) {
      process.stderr.write(`Error: unknown flag ${arg}\n`)
      process.exit(1)
    } else {
      requested.push(arg)
    }
  }

  const ctx = buildContext(dryRun)

  let targets: Target[]
  if (requested.length === 0) {
    targets = await selectInteractively(ctx)
    if (targets.length === 0) {
      process.stdout.write('Nothing selected.\n')
      return
    }
  } else if (requested.includes('all')) {
    targets = expandAll(includeDestructive).filter((t) => t.available(ctx))
  } else {
    targets = []
    for (const name of requested) {
      const t = targetById(name)
      if (!t) {
        process.stderr.write(`Error: unknown target "${name}"; run \`caracal purge --help\`\n`)
        process.exit(1)
      }
      if (!t.available(ctx)) {
        process.stdout.write(`  (skip) ${t.id}: not applicable in ${ctx.mode} mode\n`)
        continue
      }
      targets.push(t)
    }
    if (targets.length === 0) {
      process.stdout.write('Nothing to purge.\n')
      return
    }
  }

  process.stdout.write(`\nMode: ${ctx.mode}\n`)
  process.stdout.write('Will purge:\n')
  for (const t of targets) {
    process.stdout.write(`  • ${t.label} — ${t.describe(ctx)}\n`)
  }
  const destructive = targets.some((t) => t.id === 'volumes' || t.id === 'runtime')
  if (destructive && !dryRun) {
    process.stdout.write('\n!! Destructive targets selected: data WILL be lost.\n')
  }

  if (!yes && !dryRun) {
    const answer = await prompt(destructive ? '\nType "yes" to confirm: ' : '\nProceed? [y/N] ')
    const ok = destructive ? answer === 'yes' : /^y(es)?$/i.test(answer)
    if (!ok) {
      process.stdout.write('Aborted.\n')
      return
    }
  }

  for (const t of targets) {
    process.stdout.write(`\n→ ${t.label}\n`)
    try {
      await t.run(ctx)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`  ! ${t.id} failed: ${msg}\n`)
      process.exit(1)
    }
  }
  process.stdout.write(dryRun ? '\nDry-run complete.\n' : '\nPurge complete.\n')
}
