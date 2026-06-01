// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Identifier helpers for provider and resource audience strings.

import type { ProviderIdentifier, ResourceIdentifier } from './types.js'

const PROVIDER_IDENTIFIER_PATTERN = /^provider:\/\/[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESOURCE_IDENTIFIER_PREFIX = 'resource://'
const PROVIDER_IDENTIFIER_PREFIX = 'provider://'

function slugValue(value: string, fallback: string): string {
  let slug = ''
  let separator = false
  for (const character of value.trim().toLowerCase()) {
    if ((character >= 'a' && character <= 'z') || (character >= '0' && character <= '9')) {
      if (separator && slug) slug += '-'
      slug += character
      separator = false
    } else {
      separator = true
    }
  }
  return slug || fallback
}

export function providerIdentifier(value: string): ProviderIdentifier {
  const text = value.trim()
  const base = text.startsWith(PROVIDER_IDENTIFIER_PREFIX) ? text.slice(PROVIDER_IDENTIFIER_PREFIX.length) : text
  return `${PROVIDER_IDENTIFIER_PREFIX}${slugValue(base, 'provider')}` as ProviderIdentifier
}

export function isProviderIdentifier(value: string): value is ProviderIdentifier {
  return PROVIDER_IDENTIFIER_PATTERN.test(value)
}

export function resourceIdentifier(value: string): ResourceIdentifier {
  const text = value.trim()
  if (isResourceIdentifier(text)) return text
  const base = text.startsWith(RESOURCE_IDENTIFIER_PREFIX) ? text.slice(RESOURCE_IDENTIFIER_PREFIX.length) : text
  return `${RESOURCE_IDENTIFIER_PREFIX}${slugValue(base, 'resource')}`
}

export function isResourceIdentifier(value: string, controlAudience?: string): boolean {
  if (controlAudience && value === controlAudience) return true
  try {
    const url = new URL(value)
    return url.protocol !== 'provider:' && !url.username && !url.password
  } catch {
    return false
  }
}
