// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The Operator execution engine: applies an approved plan's steps through shared capability handlers.

import type { TxClient } from './db.js'
import { createZoneRecord } from './routes/zones.js'
import { createManagedApplication } from './routes/applications.js'

// The outcome of applying one step. detail is ledger-safe (never a secret); output
// carries any one-time material that must reach the caller in the HTTP response only
// and is never persisted to a turn.
export interface StepOutcome {
  detail: string
  output?: Record<string, unknown>
}

// A capability handler performs one real control-plane operation inside the caller's
// transaction. Handlers are the single execution path: they call the same shared
// functions the manual routes use, so the Operator can do nothing a route cannot.
type CapabilityHandler = (client: TxClient, zoneId: string, args: Record<string, unknown>) => Promise<StepOutcome>

const HANDLERS: Record<string, CapabilityHandler> = {
  createZone: async (client, _zoneId, args) => {
    const zone = await createZoneRecord(client, { name: String(args.name) })
    return { detail: `Created zone “${zone.name}”.`, output: { zone_id: zone.id, slug: zone.slug } }
  },
  registerApplication: async (client, zoneId, args) => {
    const { row, clientSecret } = await createManagedApplication(client, zoneId, {
      name: String(args.name),
    })
    // The plaintext secret is returned for this response only; the persisted detail
    // records that a secret was issued without ever storing it.
    return {
      detail: `Registered application “${String(args.name)}” and issued a client secret.`,
      output: { application_id: row.id, client_secret: clientSecret },
    }
  },
}

export function isExecutable(capabilityId: string): boolean {
  return capabilityId in HANDLERS
}

export interface PlanStepToExecute {
  id: string
  capability: string
  args: Record<string, unknown>
}

// Identifies steps whose capability has no execution handler. Execution refuses the
// whole plan up-front when this is non-empty so a plan never half-applies.
export function unsupportedSteps(steps: PlanStepToExecute[]): PlanStepToExecute[] {
  return steps.filter((step) => !isExecutable(step.capability))
}

// Raised when a handler fails, carrying the step so the caller can roll back the
// whole plan and record a precise failure without leaking internal error text.
export class StepExecutionError extends Error {
  constructor(
    public readonly stepId: string,
    public readonly capability: string,
    message: string,
  ) {
    super(message)
    this.name = 'StepExecutionError'
  }
}

export interface ExecutedStep {
  id: string
  capability: string
  detail: string
  output?: Record<string, unknown>
}

// Applies every step in order within the caller's open transaction. Any handler
// failure throws StepExecutionError, so the caller's transaction rolls back and no
// step is partially applied.
export async function applyPlanSteps(client: TxClient, zoneId: string, steps: PlanStepToExecute[]): Promise<ExecutedStep[]> {
  const executed: ExecutedStep[] = []
  for (const step of steps) {
    const handler = HANDLERS[step.capability]
    if (!handler) {
      throw new StepExecutionError(step.id, step.capability, 'capability is not executable')
    }
    try {
      const outcome = await handler(client, zoneId, step.args)
      executed.push({ id: step.id, capability: step.capability, detail: outcome.detail, output: outcome.output })
    } catch (err) {
      if (err instanceof StepExecutionError) throw err
      const message = err instanceof Error ? err.message : 'step failed'
      throw new StepExecutionError(step.id, step.capability, message)
    }
  }
  return executed
}
