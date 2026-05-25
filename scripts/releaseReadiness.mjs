// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Release-readiness scoring gate for Caracal stable promotion.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const minIndex = args.indexOf('--min')
const outIndex = args.indexOf('--out')
const min = minIndex >= 0 ? Number(args[minIndex + 1]) : 0
const out = outIndex >= 0 ? args[outIndex + 1] : ''

function text(path) {
  return readFileSync(path, 'utf8')
}

function has(path, pattern) {
  if (!existsSync(path)) return false
  const value = text(path)
  return typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value)
}

function category(name, checks) {
  const passed = checks.filter((check) => check.ok).length
  const score = Number(((passed / checks.length) * 10).toFixed(1))
  return { name, score, checks }
}

const categories = [
  category('developer experience', [
    { name: 'local setup runbook', ok: has('docs/src/content/docs/contributing/setup.mdx', 'pnpm caracal status --ready --json') },
    { name: 'five-minute protected request', ok: has('docs/src/content/docs/get-started/five-minute-setup.mdx', 'pnpm caracal run -- sh -c') },
    { name: 'config schema docs', ok: has('docs/src/content/docs/runtime-console/config-file.mdx', 'Lookup order') },
    { name: 'root config example', ok: existsSync('caracal.toml.example') },
    { name: 'pinned Bun in CI', ok: has('.github/workflows/test.yml', "BUN_VERSION: '1.3.14'") },
  ]),
  category('rc/testing quality', [
    { name: 'release validation is reusable', ok: has('.github/workflows/postReleaseValidation.yml', 'workflow_call') },
    { name: 'release blocks on validation', ok: has('.github/workflows/release.yml', 'Validate release artifacts') },
    { name: 'postgres migration CI', ok: has('.github/workflows/test.yml', 'PostgreSQL migrations') },
    { name: 'helm render CI', ok: has('.github/workflows/test.yml', 'Helm chart') },
    { name: 'ops docs validator', ok: has('.github/workflows/test.yml', 'validateOpsDocs.mjs') },
  ]),
  category('production reliability', [
    { name: 'immutable image promotion', ok: has('.github/workflows/release.yml', 'Promote stable image tags') },
    { name: 'manifest validator', ok: existsSync('scripts/validateReleaseManifest.mjs') },
    { name: 'archive reproducibility check', ok: has('.github/workflows/release.yml', 'Verify archive reproducibility') },
    { name: 'migration idempotency check', ok: has('infra/postgres/scripts/validateMigrations.sh', 'Migration: idempotency') },
    { name: 'upgrade rollback docs', ok: has('docs/src/content/docs/operations/upgrade.mdx', 'Rollback boundaries') },
  ]),
  category('operational readiness', [
    { name: 'alert runbooks', ok: has('docs/src/content/docs/operations/alerts.mdx', 'Alert matrix') },
    { name: 'incident response', ok: has('docs/src/content/docs/operations/incident-response.mdx', 'Triage checklist') },
    { name: 'failure modes', ok: has('docs/src/content/docs/operations/failure-modes.mdx', 'Postgres unavailable') },
    { name: 'observability endpoints', ok: has('docs/src/content/docs/operations/observability.mdx', 'Readiness semantics') },
    { name: 'alert runbook URLs', ok: has('infra/helm/caracal/templates/prometheusrule.yaml', 'runbook_url') },
  ]),
  category('scalability', [
    { name: 'HPA values', ok: has('infra/helm/caracal/values.yaml', 'hpa:') },
    { name: 'PDB templates', ok: existsSync('infra/helm/caracal/templates/pdb.yaml') },
    { name: 'replay persistence', ok: has('infra/helm/caracal/values.yaml', 'replayPersistence') },
    { name: 'capacity docs', ok: has('docs/src/content/docs/operations/scale-capacity.mdx', 'capacity') },
    { name: 'network egress profiles', ok: has('docs/src/content/docs/operations/kubernetes-helm.mdx', 'CoreDNS-scoped example') },
  ]),
  category('release engineering maturity', [
    { name: 'environment approval', ok: has('.github/workflows/release.yml', 'release-approval') },
    { name: 'protected npm publish', ok: existsSync('.github/workflows/publishNpm.yml') },
    { name: 'protected PyPI publish', ok: has('.github/workflows/publishPypi.yml', 'name: pypi') },
    { name: 'atomic release push', ok: has('scripts/release.sh', 'git push --atomic') },
    { name: 'manifest schema', ok: existsSync('releases/schema/manifest.schema.json') },
  ]),
  category('security hardening', [
    { name: 'stable plaintext secret guard', ok: has('infra/helm/caracal/templates/secret.yaml', 'global.mode=stable') },
    { name: 'production DNS closed', ok: has('infra/helm/caracal/values.yaml', 'allowOpenDns: false') },
    { name: 'installer provenance required mode', ok: has('install-console.sh', '--require-provenance') && has('install-console.ps1', 'RequireProvenance') },
    { name: 'tag protection docs', ok: has('docs/src/content/docs/contributing/release.mdx', 'Protected tags') },
    { name: 'local stable publish guard', ok: has('scripts/publishNpm.sh', 'CARACAL_ALLOW_LOCAL_STABLE_PUBLISH') && has('scripts/publishPypi.sh', 'CARACAL_ALLOW_LOCAL_STABLE_PUBLISH') },
  ]),
]

const overall = Number((categories.reduce((sum, item) => sum + item.score, 0) / categories.length).toFixed(1))
const report = { overall, categories }
const markdown = [
  `# Release readiness: ${overall}/10`,
  '',
  '| Dimension | Score |',
  '| --- | ---: |',
  ...categories.map((item) => `| ${item.name} | ${item.score.toFixed(1)} |`),
  '',
]

if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown.join('\n'), { flag: 'a' })
}
if (min > 0 && overall < min) {
  throw new Error(`release readiness ${overall} is below required ${min}`)
}
