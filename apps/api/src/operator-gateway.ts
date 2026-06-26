// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The Operator LLM gateway: a provider-agnostic, OpenAI-compatible completion client with multi-provider failover.

// A single configured backend. The OpenAI-compatible chat surface is the common
// denominator across hosted providers (OpenAI, Together, Groq), local servers
// (Ollama, vLLM), and gateways (LiteLLM), so one client reaches all of them. A
// missing apiKey is valid for local backends that need no credential.
export interface ProviderConfig {
  id: string
  baseUrl: string
  model: string
  apiKey?: string
  timeoutMs: number
  // The model's context window in tokens, supplied by the administrator since it is a
  // property of the chosen model rather than the transport. Zero means unknown, in which
  // case usage is reported as raw counts without a percentage of the window.
  contextWindow: number
}

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  // The id of the provider the caller would like to use first. When it is configured and
  // available it is tried ahead of the failover order; otherwise it is ignored and the
  // normal order applies, so a stale preference never disables the gateway.
  preferredProvider?: string
}

export interface CompletionResult {
  text: string
  // The model's chain of thought when a reasoning model exposes it, either through the
  // OpenAI-compatible reasoning_content channel or inline <think> tags. Absent for models
  // that return only an answer.
  reasoning?: string
  provider: string
  model: string
  promptTokens?: number
  completionTokens?: number
}

export interface ProviderStatus {
  id: string
  model: string
  // Whether the provider is configured well enough to attempt a call. It does not
  // assert reachability — that is what the connectivity check verifies — and never
  // exposes whether a key is present beyond this boolean.
  available: boolean
  // The model's context window in tokens, or zero when the administrator has not
  // declared it. Surfaced so the console can show usage against the chosen model.
  contextWindow: number
}

export interface GatewayStatus {
  enabled: boolean
  providers: ProviderStatus[]
}

// The model that the next completion would run against, with its context window. Null
// when no provider is configured. Drawn from the first available provider, which is the
// one the failover order tries first.
export interface ActiveModel {
  model: string
  contextWindow: number
}

// Cumulative token usage tallied by a usage-tracking gateway wrapper over the calls made
// during a single request, so it never mixes usage across conversations.
export interface GatewayUsage {
  inputTokens: number
  outputTokens: number
}

// No provider is configured, so the AI tier is off. Distinct from a call failure so
// callers can degrade gracefully rather than treat "off" as an error.
export class GatewayUnavailableError extends Error {
  constructor() {
    super('no AI provider is configured')
    this.name = 'GatewayUnavailableError'
  }
}

// Every configured provider failed. attempts lists the per-provider failure reason
// with secrets already redacted, so it is safe to surface or log.
export class GatewayError extends Error {
  constructor(public readonly attempts: { provider: string; reason: string }[]) {
    super(`all AI providers failed (${attempts.length} attempted)`)
    this.name = 'GatewayError'
  }
}

type FetchImpl = typeof fetch

function providerAvailable(provider: ProviderConfig): boolean {
  return provider.baseUrl.length > 0 && provider.model.length > 0
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string; reasoning_content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

// Separates a reasoning model's chain of thought from its answer. Reasoning arrives
// either in the OpenAI-compatible reasoning_content channel or inline as a leading
// <think>...</think> block; the answer is the content with any think block removed.
function splitReasoning(content: string, reasoningField?: string): { text: string; reasoning?: string } {
  const inline = content.match(/<think>([\s\S]*?)<\/think>/i)
  const answer = inline ? content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() : content.trim()
  const field = typeof reasoningField === 'string' ? reasoningField.trim() : ''
  const reasoning = field.length > 0 ? field : inline ? inline[1].trim() : ''
  return {
    text: answer.length > 0 ? answer : content.trim(),
    reasoning: reasoning.length > 0 ? reasoning : undefined,
  }
}

// Performs one OpenAI-compatible chat completion against a single provider. Network
// failures, non-2xx responses, and timeouts all throw, so the caller can fail over.
async function callProvider(
  fetchImpl: FetchImpl,
  provider: ProviderConfig,
  messages: GatewayMessage[],
  options: CompletionOptions,
): Promise<CompletionResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs)
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`
    const res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`provider returned status ${res.status}`)
    }
    const body = (await res.json()) as ChatCompletionResponse
    const message = body.choices?.[0]?.message
    if (typeof message?.content !== 'string' || message.content.length === 0) {
      throw new Error('provider returned an empty completion')
    }
    const { text, reasoning } = splitReasoning(message.content, message.reasoning_content)
    return {
      text,
      reasoning,
      provider: provider.id,
      model: provider.model,
      promptTokens: body.usage?.prompt_tokens,
      completionTokens: body.usage?.completion_tokens,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export interface Gateway {
  status(): GatewayStatus
  active(): ActiveModel | null
  complete(messages: GatewayMessage[], options?: CompletionOptions): Promise<CompletionResult>
}

// Builds a gateway over an ordered provider list. The order is the failover order:
// complete() tries each available provider in turn and returns the first success.
// fetchImpl is injectable so the transport can be exercised without a live backend.
export function createGateway(providers: ProviderConfig[], fetchImpl: FetchImpl = fetch): Gateway {
  const available = providers.filter(providerAvailable)

  return {
    status() {
      return {
        enabled: available.length > 0,
        providers: providers.map((provider) => ({
          id: provider.id,
          model: provider.model,
          available: providerAvailable(provider),
          contextWindow: provider.contextWindow,
        })),
      }
    },

    active() {
      const provider = available[0]
      return provider ? { model: provider.model, contextWindow: provider.contextWindow } : null
    },

    async complete(messages, options = {}) {
      if (available.length === 0) throw new GatewayUnavailableError()
      // Try the caller's preferred provider first when it is available, then the rest in
      // failover order. A preference for an unknown or unavailable provider is ignored.
      const order = [...available]
      if (options.preferredProvider) {
        const index = order.findIndex((provider) => provider.id === options.preferredProvider)
        if (index > 0) {
          const [preferred] = order.splice(index, 1)
          order.unshift(preferred)
        }
      }
      const attempts: { provider: string; reason: string }[] = []
      for (const provider of order) {
        try {
          return await callProvider(fetchImpl, provider, messages, options)
        } catch (err) {
          // The reason is derived from the error message only; provider headers and
          // keys never enter it, so attempts is safe to surface.
          const reason = err instanceof Error ? err.message : 'unknown error'
          attempts.push({ provider: provider.id, reason })
        }
      }
      throw new GatewayError(attempts)
    },
  }
}

// Wraps a gateway for the span of a single request so the real token usage of every
// completion made through it is tallied. The underlying gateway is shared across
// requests, so usage must be collected per call here rather than held on the gateway.
export function withUsage(gateway: Gateway): { gateway: Gateway; usage: () => GatewayUsage } {
  let inputTokens = 0
  let outputTokens = 0
  const tracked: Gateway = {
    status: () => gateway.status(),
    active: () => gateway.active(),
    async complete(messages, options) {
      const result = await gateway.complete(messages, options)
      inputTokens += result.promptTokens ?? 0
      outputTokens += result.completionTokens ?? 0
      return result
    },
  }
  return { gateway: tracked, usage: () => ({ inputTokens, outputTokens }) }
}

// Wraps a gateway so every completion prefers the given provider, without touching the
// agents that call complete(). A null id is a no-op, so callers can wrap unconditionally.
export function preferProvider(gateway: Gateway, providerId: string | null): Gateway {
  if (!providerId) return gateway
  return {
    status: () => gateway.status(),
    active: () => gateway.active(),
    complete: (messages, options = {}) => gateway.complete(messages, { ...options, preferredProvider: providerId }),
  }
}
