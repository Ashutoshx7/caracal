#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Renders the platform-neutral Caracal topology into a managed container platform manifest set.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

import { azureContainerApps } from './targets/azureContainerApps.mjs'
import { awsEcs } from './targets/awsEcs.mjs'
import { gcpCloudRun } from './targets/gcpCloudRun.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// A target is a provider adapter. It declares how its platform delivers secrets,
// resolves in-environment service addresses, and renders the plan. Nothing else
// in this file knows a provider exists.
const targets = {
  azureContainerApps,
  awsEcs,
  gcpCloudRun,
}

const requiredConfig = [
  'release.registry',
  'release.version',
  'mode',
  'database.host',
  'database.port',
  'database.user',
  'database.name',
  'database.sslMode',
  'public.web',
]

function fail(message) {
  console.error(`render: ${message}`)
  process.exit(1)
}

function readPath(source, path) {
  return path.split('.').reduce((node, key) => (node == null ? node : node[key]), source)
}

// The name a unit is created under on every platform. Adapters and apply flows
// both derive from this, so an address a service is told to call is always the
// name that service was deployed as.
function resourceName(name) {
  return `caracal-${name.toLowerCase()}`
}

function parseArgs(argv) {
  const args = { config: '', out: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--config') args.config = argv[++i]
    else if (flag === '--out') args.out = argv[++i]
    else fail(`unknown argument ${flag}`)
  }
  if (!args.config) fail('--config <deployment.yaml> is required')
  if (!args.out) fail('--out <directory> is required')
  return args
}

// Every deployment-specific value a service needs arrives through one of these
// placeholders, so a target never has to know which environment variable carries
// which piece of deployment identity.
function makeResolver(config, target, topology) {
  // Adapters receive the service descriptor rather than a bare name so they never
  // have to restate a topology fact such as a port.
  const serviceRef = (name) => {
    const service = topology.services[name]
    if (!service) fail(`topology.services.${name} is not defined`)
    return { name, port: service.port, resourceName: resourceName(name) }
  }

  const scalars = {
    '{state}': topology.statePath,
    '{mode}': config.mode,
    '{logLevel}': config.logLevel ?? 'info',
    '{otlp}': config.observability?.otlpEndpoint ?? '',
    '{issuer}': config.public?.sts || target.internalUrl(serviceRef('sts'), config),
  }

  return function resolve(value) {
    return String(value).replace(/\{[^}]+\}/g, (token) => {
      if (token in scalars) return scalars[token]
      const [kind, key] = token.slice(1, -1).split(':')
      if (kind === 'internal') return target.internalUrl(serviceRef(key), config)
      if (kind === 'public') {
        const url = config.public?.[key]
        if (!url) fail(`public.${key} is required but not set`)
        return url
      }
      const [group, field] = token.slice(1, -1).split('.')
      const scoped = readPath(config, `${group}.${field}`)
      if (scoped === undefined) fail(`config.${group}.${field} is required but not set`)
      return String(scoped)
    })
  }
}

// Services accept a credential either directly or through its _FILE form. Where
// the platform can project secrets onto a filesystem the file form is used so no
// credential sits in the process environment; where it cannot, the variable is
// bound directly. This is the only place that choice is made.
function applySecretDelivery(unit, delivery, secretMountPath) {
  if (delivery === 'file') {
    const fileEnv = Object.fromEntries(
      Object.entries(unit.secretEnv).map(([name, key]) => [`${name}_FILE`, `${secretMountPath}/${key}`]),
    )
    // Two variables may be fed by one credential, which would otherwise project
    // the same file twice and produce an invalid volume.
    const secretFiles = [...new Set(Object.values(unit.secretEnv))]
    return { env: { ...unit.env, ...fileEnv }, secretFiles, envSecrets: {} }
  }
  return { env: unit.env, secretFiles: [], envSecrets: unit.secretEnv }
}

function buildPlan(topology, config, target) {
  const resolve = makeResolver(config, target, topology)
  const resolveMap = (source = {}) =>
    Object.fromEntries(Object.entries(source).map(([key, value]) => [key, resolve(value)]))

  const imageRef = (key) => {
    const repository = topology.images[key]
    if (!repository) fail(`topology.images.${key} is not defined`)
    return `${config.release.registry}/${repository}:v${config.release.version}`
  }

  const services = Object.entries(topology.services).map(([name, service]) => {
    const standalone = service.common === false
    const secretEnv = { ...(standalone ? {} : topology.commonSecretEnv), ...service.secretEnv }
    const env = {
      ...(standalone ? {} : resolveMap(topology.commonEnv)),
      PORT: String(service.port),
      ...resolveMap(service.env),
    }
    return {
      name,
      resourceName: resourceName(name),
      image: imageRef(service.image),
      command: service.command,
      args: service.args ?? [],
      port: service.port,
      exposure: service.exposure,
      scale: service.scale,
      resources: service.resources,
      probes: topology.probes,
      state: Boolean(service.state),
      ...applySecretDelivery({ env, secretEnv }, target.secretDelivery, topology.secretMountPath),
    }
  })

  const jobs = topology.jobs.map((job) => ({
    name: job.name,
    resourceName: resourceName(job.name),
    image: imageRef(job.image),
    command: job.command,
    args: job.args ?? [],
    resources: job.resources,
    state: false,
    ...applySecretDelivery(
      { env: resolveMap(job.env), secretEnv: job.secretEnv ?? {} },
      target.secretDelivery,
      topology.secretMountPath,
    ),
  }))

  const secretKeys = [
    ...new Set([
      ...services.flatMap((s) => [...s.secretFiles, ...Object.values(s.envSecrets)]),
      ...jobs.flatMap((j) => [...j.secretFiles, ...Object.values(j.envSecrets)]),
    ]),
  ].sort()

  return {
    release: config.release,
    secretMountPath: topology.secretMountPath,
    statePath: topology.statePath,
    secretKeys,
    services,
    jobs,
  }
}

function validateConfig(config) {
  const missing = requiredConfig.filter((path) => {
    const value = readPath(config, path)
    return value === undefined || value === null || value === ''
  })
  if (missing.length > 0) fail(`missing required config: ${missing.join(', ')}`)
  if (!targets[config.target]) {
    fail(`unknown target "${config.target}"; available: ${Object.keys(targets).join(', ')}`)
  }
  if (config.mode === 'stable' && config.logLevel === 'debug') {
    fail('logLevel=debug is not permitted when mode=stable')
  }
  for (const [name, url] of Object.entries(config.public ?? {})) {
    if (!url.startsWith('https://')) fail(`public.${name} must be an https origin`)
  }
}

function validateTarget(name, target) {
  for (const member of ['secretDelivery', 'internalUrl', 'render']) {
    if (target[member] === undefined) fail(`target "${name}" does not implement ${member}`)
  }
  if (!['file', 'env'].includes(target.secretDelivery)) {
    fail(`target "${name}" declares an unknown secretDelivery "${target.secretDelivery}"`)
  }
}

const args = parseArgs(process.argv.slice(2))
const config = parse(readFileSync(resolve(args.config), 'utf8'))
validateConfig(config)

const topology = parse(readFileSync(join(here, 'topology.yaml'), 'utf8'))
const target = targets[config.target]
validateTarget(config.target, target)

if (target.experimental) {
  console.warn(`render: target "${config.target}" is experimental and has not been production-tested`)
}

// An adapter reports a missing or unusable provider value by throwing. Surfacing
// it as a message keeps a configuration mistake readable instead of a stack trace.
let files
try {
  const plan = buildPlan(topology, config, target)
  files = target.render(plan, config)
} catch (error) {
  fail(error.message)
}

const outDir = resolve(args.out)
mkdirSync(outDir, { recursive: true })
for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(outDir, name), body)
  console.log(`rendered ${join(args.out, name)}`)
}
