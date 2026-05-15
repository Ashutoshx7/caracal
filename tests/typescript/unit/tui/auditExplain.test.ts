// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// audit-explain form submits the request_id and pushes a populated DetailView.

import { describe, it, expect, vi } from 'vitest'

import { MenuView } from '../../../../apps/tui/src/views/menu.ts'
import { FormView } from '../../../../apps/tui/src/views/form.ts'
import { DetailView } from '../../../../apps/tui/src/views/detail.ts'
import type { App } from '../../../../apps/tui/src/screen.ts'
import type { AdminClient } from '@caracalai/admin'

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

describe('audit explain entry', () => {
  it('submits request_id and pushes a populated DetailView', async () => {
    const byRequest = vi.fn(async () => ({ request_id: 'req-42', decision: 'allow' }))
    const client = { audit: { byRequest } } as unknown as AdminClient
    const menu = new MenuView(client, 'z1')
    const app = fakeApp()
    await menu.onKey('x', { app, size: { rows: 25, cols: 80 }, status: '' })
    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const form = pushed[pushed.length - 1] as FormView
    expect(form).toBeInstanceOf(FormView)
    ;(form as unknown as { values: Record<string, string> }).values = { request_id: 'req-42' }
    ;(form as unknown as { focus: number }).focus = 1
    await form.onKey('enter', { app, size: { rows: 25, cols: 80 }, status: '' })
    const detail = pushed[pushed.length - 1] as DetailView
    expect(detail).toBeInstanceOf(DetailView)
    await detail.init(app)
    const body = detail.render({ app, size: { rows: 20, cols: 80 }, status: '' }).join('\n')
    expect(body).toContain('"req-42"')
    expect(body).toContain('"allow"')
    expect(byRequest).toHaveBeenCalledWith('z1', 'req-42')
  })
})
