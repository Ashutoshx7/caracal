// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Operational documentation validator for alert runbooks.

import { readFileSync } from 'node:fs'

const rulePath = 'infra/helm/caracal/templates/prometheusrule.yaml'
const docsPath = 'docs/src/content/docs/operations/alerts.mdx'
const rules = readFileSync(rulePath, 'utf8')
const docs = readFileSync(docsPath, 'utf8').toLowerCase()
const alerts = [...rules.matchAll(/- alert: (Caracal[A-Za-z0-9]+)/g)].map((match) => match[1])

for (const alert of alerts) {
  const anchor = alert.toLowerCase()
  if (!docs.includes(`## ${alert}`.toLowerCase())) {
    throw new Error(`${alert} is missing from ${docsPath}`)
  }
  if (!rules.includes(`runbook_url: https://docs.caracal.run/operations/alerts/#${anchor}`)) {
    throw new Error(`${alert} is missing a runbook_url annotation`)
  }
}

console.log('operations alert docs ok')
