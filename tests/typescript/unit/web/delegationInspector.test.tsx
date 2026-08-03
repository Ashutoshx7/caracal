/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file verifies the delegation inspector cancels superseded reads instead of showing a stale blast radius.
*/
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const traverse = vi.fn()
const impact = vi.fn()

vi.mock('@/platform/api/client', () => ({
  consoleApi: {
    delegations: { traverse, impact, revoke: vi.fn() },
    resources: { list: vi.fn(async () => []) },
    applications: { list: vi.fn(async () => []) },
  },
}))

const { DelegationInspector } = await import('@/components/console/DelegationInspector')
const { ToastProvider } = await import('@/components/ui/Toast')

function edge(id: string) {
  return {
    id,
    zone_id: 'z1',
    source_session_id: 's1',
    target_session_id: 's2',
    issuer_application_id: 'app-1',
    receiver_application_id: 'app-2',
    parent_edge_id: null,
    resource_id: null,
    scopes: ['data:read'],
    constraints_json: null,
    status: 'active',
    edge_version: 1,
    expires_at: null,
    revoked_at: null,
    created_at: new Date().toISOString(),
  }
}

function hop(id: string) {
  return { id, source_session_id: 's1', target_session_id: 's2', depth: 1 }
}

function impactFor(id: string, sessions: string[]) {
  return { delegationId: id, affectedDelegations: [], affectedSessions: sessions, affectedAuthorityRecords: [] }
}

function renderInspector(edgeId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DelegationInspector zoneId="z1" edge={edge(edgeId)} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  const show = (nextId: string) =>
    view.rerender(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <DelegationInspector zoneId="z1" edge={edge(nextId)} />
        </ToastProvider>
      </QueryClientProvider>,
    )
  return { ...view, show }
}

afterEach(() => {
  cleanup()
  traverse.mockReset()
  impact.mockReset()
})

describe('DelegationInspector', () => {
  it('passes an abort signal so a superseded read is cancelled', async () => {
    traverse.mockResolvedValue([hop('edge-1')])
    impact.mockResolvedValue(impactFor('edge-1', ['session-a']))

    renderInspector('edge-1')

    await waitFor(() => expect(traverse).toHaveBeenCalled())
    const signal = traverse.mock.calls[0][2]
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)
  })

  it("shows the selected delegation's chain, never a slower earlier one", async () => {
    // The first edge resolves after the second, which is the ordering that used to let a stale
    // response repaint the inspector with another delegation's chain and blast radius.
    let releaseFirst: (() => void) | undefined
    const firstSettled = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    traverse.mockImplementation(async (_zone: string, id: string) => {
      if (id === 'edge-1') await firstSettled
      return id === 'edge-1' ? [hop('h1'), hop('h2'), hop('h3')] : [hop('h9')]
    })
    impact.mockImplementation(async (_zone: string, id: string) => {
      if (id === 'edge-1') await firstSettled
      return impactFor(id, [id])
    })

    const view = renderInspector('edge-1')
    await waitFor(() => expect(traverse).toHaveBeenCalledTimes(1))

    view.show('edge-2')
    await waitFor(() => expect(traverse).toHaveBeenCalledTimes(2))

    releaseFirst?.()
    await firstSettled

    // The three-hop chain belongs to the superseded edge; resolving late must not display it.
    await waitFor(() => expect(screen.getByText(/Authority chain \(1\)/)).toBeTruthy())
    expect(screen.queryByText(/Authority chain \(3\)/)).toBeNull()
  })
})
