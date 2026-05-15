// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Interactive command shell for `caracal cli` (no args): a controlled REPL that only accepts whitelisted commands, with tab completion and command history.

import { createInterface, type CompleterResult } from 'node:readline'
import { COMMAND_NAME_PATTERN } from '@caracalai/core/commands'
import { style, printError, printInfo } from './style.ts'
import type { CommandRegistry } from './registry.ts'
import type { CliConfig } from './config.ts'
import { printUsage, type DispatchOptions } from './dispatcher.ts'

export interface ReplOptions {
  readonly dispatchOptions: DispatchOptions
  readonly cfg?: CliConfig
}

function splitArgs(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let esc = false
  for (const ch of line) {
    if (esc) { cur += ch; esc = false; continue }
    if (ch === '\\' && !quote) { esc = true; continue }
    if (quote) {
      if (ch === quote) { quote = null; continue }
      cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = '' }
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const BUILTINS = ['help', 'exit', 'quit', 'clear'] as const

class ReplExit extends Error {
  readonly code: number
  constructor(code: number) {
    super(`repl-exit:${code}`)
    this.code = code
  }
}

function buildCompleter(registry: CommandRegistry): (line: string) => CompleterResult {
  const visible = registry.ordered.filter((b) => !b.descriptor.hidden).map((b) => b.descriptor.name)
  const all = [...new Set([...visible, ...BUILTINS])].sort()
  return (line) => {
    const trimmed = line.trimStart()
    const firstSpace = trimmed.indexOf(' ')
    if (firstSpace === -1) {
      const hits = all.filter((c) => c.startsWith(trimmed))
      return [hits.length ? hits : all, trimmed]
    }
    return [[], line]
  }
}

export async function startRepl(opts: ReplOptions): Promise<void> {
  if (!process.stdin.isTTY) {
    printError(`${opts.dispatchOptions.binary}: interactive shell requires a TTY (pass a command, e.g. \`${opts.dispatchOptions.binary} status\`)`)
    process.exit(1)
  }
  const { registry } = opts.dispatchOptions
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${style.prompt('caracal')}${style.label('› ')}`,
    completer: buildCompleter(registry),
    terminal: true,
    historySize: 500,
  })

  printInfo(`Caracal CLI ${opts.dispatchOptions.version} — interactive shell. Type \`help\` for commands, \`exit\` to quit.`)
  rl.prompt()

  let exitCode = 0
  for await (const raw of rl) {
    const line = raw.trim()
    if (!line) { rl.prompt(); continue }
    const args = splitArgs(line)
    const cmd = args[0]
    if (cmd === 'exit' || cmd === 'quit') { rl.close(); break }
    if (cmd === 'clear') { process.stdout.write('\x1b[2J\x1b[H'); rl.prompt(); continue }
    if (cmd === 'help' || cmd === '--help' || cmd === '-h' || cmd === '?') {
      printUsage(opts.dispatchOptions, process.stdout)
      rl.prompt()
      continue
    }
    if (!COMMAND_NAME_PATTERN.test(cmd) || !registry.byName.has(cmd) || registry.byName.get(cmd)!.descriptor.hidden) {
      printError(`unknown command: ${cmd} (type \`help\`)`)
      rl.prompt()
      continue
    }
    const binding = registry.byName.get(cmd)!
    const origExit = process.exit
    process.exit = ((code?: number) => { throw new ReplExit(code ?? 0) }) as typeof process.exit
    try {
      await binding.run(args.slice(1), opts.cfg)
    } catch (err) {
      if (err instanceof ReplExit) {
        if (err.code !== 0) exitCode = err.code
      } else {
        exitCode = 1
        printError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      process.exit = origExit
    }
    rl.prompt()
  }
  process.stdout.write('\n')
  if (exitCode !== 0) process.exit(exitCode)
}
