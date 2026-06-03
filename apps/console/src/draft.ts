// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Reusable draft pipeline that stages dependent object creations and commits them in dependency order.

export interface DraftResolver {
  get<T>(key: string): T
  has(key: string): boolean
}

export interface DraftStage<T> {
  dependsOn?: readonly string[]
  skip?: (resolved: DraftResolver) => boolean
  commit: (resolved: DraftResolver) => Promise<T> | T
}

export class DraftPipeline {
  private readonly stages = new Map<string, DraftStage<unknown>>()
  private readonly order: string[] = []

  stage<T>(key: string, stage: DraftStage<T>): this {
    if (this.stages.has(key)) throw new Error(`draft stage already defined: ${key}`)
    this.stages.set(key, stage as DraftStage<unknown>)
    this.order.push(key)
    return this
  }

  has(key: string): boolean {
    return this.stages.has(key)
  }

  async commit(): Promise<DraftResolver> {
    const outputs = new Map<string, unknown>()
    const skipped = new Set<string>()
    const resolver: DraftResolver = {
      get: <T>(key: string): T => {
        if (skipped.has(key)) throw new Error(`draft stage was skipped: ${key}`)
        if (!outputs.has(key)) throw new Error(`draft stage not committed: ${key}`)
        return outputs.get(key) as T
      },
      has: (key: string): boolean => outputs.has(key),
    }
    for (const key of this.commitOrder()) {
      const stage = this.stages.get(key)!
      if (stage.skip?.(resolver)) {
        skipped.add(key)
        continue
      }
      outputs.set(key, await stage.commit(resolver))
    }
    return resolver
  }

  private commitOrder(): string[] {
    const result: string[] = []
    const phase = new Map<string, 'visiting' | 'done'>()
    const visit = (key: string, chain: readonly string[]): void => {
      const current = phase.get(key)
      if (current === 'done') return
      if (current === 'visiting') throw new Error(`draft pipeline has a dependency cycle: ${[...chain, key].join(' -> ')}`)
      phase.set(key, 'visiting')
      for (const dep of this.stages.get(key)!.dependsOn ?? []) {
        if (!this.stages.has(dep)) throw new Error(`draft stage "${key}" depends on unknown stage "${dep}"`)
        visit(dep, [...chain, key])
      }
      phase.set(key, 'done')
      result.push(key)
    }
    for (const key of this.order) visit(key, [])
    return result
  }
}
