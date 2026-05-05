/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Astro configuration for the Caracal documentation site.
 */

import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://docs.caracal.ai',
  integrations: [
    starlight({
      title: 'Caracal',
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Getting Started', slug: 'getting-started' },
            { label: 'Architecture', slug: 'architecture' },
          ],
        },
        {
          label: 'Build',
          items: [
            { label: 'SDKs', slug: 'sdks' },
            { label: 'Operations', slug: 'operations' },
          ],
        },
      ],
    }),
  ],
})
