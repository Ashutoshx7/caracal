// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Menu zone hotkey tests cover picker launch and selected zone application.

import { describe, it, expect, vi } from 'vitest'

import { MenuView } from '../../../../apps/tui/src/views/menu.ts'
import type { App } from '../../../../apps/tui/src/screen.ts'
import type { AdminClient, Zone } from '@caracalai/admin'

function fakeApp(): App {
  const pushed: unknown[] = []
  const app = {
    invalidate: vi.fn(),
    push: vi.fn((v: unknown) => { pushed.push(v) }),
    pop: vi.fn(),
    setStatus: vi.fn(),
    current: vi.fn(),
    exit: vi.fn(async () => {}),
    replaceTop: vi.fn(),
    bannerLeft: '',
    bannerRight: '',
  } as unknown as App
  ;(app as unknown as { _pushed: unknown[] })._pushed = pushed
  return app
}

function clientWithZones(zones: Zone[]): AdminClient {
  return {
    zones: {
      list: vi.fn(async () => zones),
      get: vi.fn(async () => ({})),
    },
  } as unknown as AdminClient
}

describe('menu zone hotkey', () => {
  it('opens the zone picker with z and applies the selected zone', async () => {
    const client = clientWithZones([
      { id: 'z1', slug: 'alpha', name: 'Alpha' },
      { id: 'z2', slug: 'beta', name: 'Beta' },
    ] as Zone[])
    const menu = new MenuView(client, undefined)
    const app = fakeApp()

    await menu.onKey('z', { app, size: { rows: 25, cols: 80 }, status: '' })
    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const picker = pushed[pushed.length - 1] as { title: string; onKey: MenuView['onKey'] }

    expect(client.zones.list).toHaveBeenCalledOnce()
    expect(picker.title).toBe('select zone')

    await picker.onKey('down', { app, size: { rows: 25, cols: 80 }, status: '' })
    await picker.onKey('enter', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(menu.currentZoneId()).toBe('z2')
    expect(app.setStatus).toHaveBeenCalledWith('zone set to beta')
    expect(app.pop).toHaveBeenCalledOnce()
  })

  it('opens the zone picker with uppercase Z', async () => {
    const client = clientWithZones([{ id: 'z1', slug: 'alpha', name: 'Alpha' }] as Zone[])
    const menu = new MenuView(client, undefined)
    const app = fakeApp()

    await menu.onKey('Z', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(client.zones.list).toHaveBeenCalledOnce()
    expect(app.push).toHaveBeenCalledWith(expect.objectContaining({ title: 'select zone' }))
  })
})
