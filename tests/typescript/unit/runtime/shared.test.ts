// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Runtime shared helpers: argv parser and flag coercions.

import { describe, it, expect } from 'vitest'
import {
  parseArgs,
  flagString,
  flagBool,
  flagInt,
  flagList,
} from '../../../../apps/runtime/src/commands/shared.ts'

describe('parseArgs', () => {
  it('separates positional args and flags', () => {
    const out = parseArgs(['create', '--name', 'x', '--force'])
    expect(out.positional).toEqual(['create'])
    expect(out.flags).toEqual({ name: 'x', force: true })
  })

  it('treats following positional as the flag value when present', () => {
    const out = parseArgs(['--force', 'tail'])
    expect(out.positional).toEqual([])
    expect(out.flags).toEqual({ force: 'tail' })
  })

  it('accepts --key=value', () => {
    expect(parseArgs(['--limit=50']).flags).toEqual({ limit: '50' })
  })

  it('treats trailing flag without value as boolean', () => {
    expect(parseArgs(['--json']).flags).toEqual({ json: true })
  })

  it('does not consume the next flag as a value', () => {
    const out = parseArgs(['--zone', '--json'])
    expect(out.flags).toEqual({ zone: true, json: true })
  })
})

describe('flag coercions', () => {
  const flags = parseArgs(['--limit', '25', '--debug', '--scopes', 'a,b, c']).flags

  it('flagString returns string only', () => {
    expect(flagString(flags, 'limit')).toBe('25')
    expect(flagString(flags, 'debug')).toBeUndefined()
  })

  it('flagBool detects true and string "true"', () => {
    expect(flagBool(flags, 'debug')).toBe(true)
    expect(flagBool({ x: 'true' }, 'x')).toBe(true)
    expect(flagBool({}, 'missing')).toBe(false)
  })

  it('flagInt parses base-10 integers', () => {
    expect(flagInt(flags, 'limit')).toBe(25)
    expect(flagInt({ x: 'abc' }, 'x')).toBeUndefined()
  })

  it('flagList splits, trims, and drops empties', () => {
    expect(flagList(flags, 'scopes')).toEqual(['a', 'b', 'c'])
    expect(flagList({}, 'missing')).toBeUndefined()
  })
})
