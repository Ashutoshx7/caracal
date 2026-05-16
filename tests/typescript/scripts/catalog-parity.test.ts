// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Asserts the Go command catalog mirrors the canonical TypeScript catalog one-for-one.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLI_COMMANDS } from '../../../packages/core/ts/src/commands.ts'

interface GoEntry { name: string; subs: string[]; hidden: boolean }

function parseGoCatalog(src: string): GoEntry[] {
  const out: GoEntry[] = []
  const block = src.match(/var CLI = \[\]Descriptor\{([\s\S]*?)\n\}/)
  if (!block) throw new Error('Go catalog block not found')
  const body = block[1]!
  const entryRe = /\{Name:\s*"([^"]+)"[^}]*?(?:Subcommands:\s*\[\]string\{([^}]*)\})?[^}]*?(?:Hidden:\s*(true|false))?[^}]*?\}/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(body))) {
    const subsRaw = m[2] ?? ''
    const subs = subsRaw.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? []
    out.push({ name: m[1]!, subs, hidden: m[3] === 'true' })
  }
  return out
}

describe('catalog parity (TS ↔ Go)', () => {
  const goSrc = readFileSync(join(__dirname, '../../../packages/core/go/commands/catalog.go'), 'utf8')
  const goEntries = parseGoCatalog(goSrc)

  it('has the same number of commands', () => {
    expect(goEntries.length).toBe(CLI_COMMANDS.length)
  })
  it('has matching names in the same order', () => {
    expect(goEntries.map((e) => e.name)).toEqual(CLI_COMMANDS.map((c) => c.name))
  })
  it('has matching subcommand lists', () => {
    for (let i = 0; i < CLI_COMMANDS.length; i++) {
      const ts = CLI_COMMANDS[i]!
      const go = goEntries[i]!
      expect(go.subs).toEqual([...(ts.subcommands ?? [])])
    }
  })
  it('has matching hidden flags', () => {
    for (let i = 0; i < CLI_COMMANDS.length; i++) {
      expect(goEntries[i]!.hidden).toBe(CLI_COMMANDS[i]!.hidden === true)
    }
  })
})
