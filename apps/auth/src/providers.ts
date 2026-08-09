// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The social provider registry and per-installation provider resolution.

import { resolveFileSecrets } from '@caracalai/server-core'

import type { AuthConfig } from './config.ts'

// One row per supported social provider. Credentials resolve from
// `<envPrefix>_CLIENT_ID` / `<envPrefix>_CLIENT_SECRET`, so adding a provider
// is a row here, a Better Auth entry keyed by id, and a button in the console.
export const SOCIAL_PROVIDERS = [
  { id: 'google', envPrefix: 'GOOGLE' },
  { id: 'github', envPrefix: 'GITHUB' },
] as const

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]['id']

export interface SocialProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface EnabledProviders {
  email: boolean
  social: SocialProviderId[]
  passwordReset: boolean
}

// Provider client secrets follow the `_FILE` secret convention like every other credential, so
// they can be delivered as mounted secret files rather than inline environment values.
resolveFileSecrets(SOCIAL_PROVIDERS.flatMap(({ envPrefix }) => [`${envPrefix}_CLIENT_ID`, `${envPrefix}_CLIENT_SECRET`]))

export function socialCredentials(id: SocialProviderId): SocialProviderCredentials | null {
  const provider = SOCIAL_PROVIDERS.find((entry) => entry.id === id)
  if (!provider) return null
  const clientId = process.env[`${provider.envPrefix}_CLIENT_ID`]
  const clientSecret = process.env[`${provider.envPrefix}_CLIENT_SECRET`]
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function enabledSocialProviders(): SocialProviderId[] {
  return SOCIAL_PROVIDERS.filter(({ id }) => socialCredentials(id) !== null).map(({ id }) => id)
}

export function enabledProviders(cfg: AuthConfig): EnabledProviders {
  return {
    email: true,
    social: enabledSocialProviders(),
    // Reset links travel by email, so the capability only exists when a mail transport is
    // configured; the web console hides its reset entry points when this is false.
    passwordReset: cfg.smtpUrl !== null,
  }
}
