// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Google Cloud Run target: maps the neutral Caracal plan onto Cloud Run services and jobs.

// Experimental. Rendered and schema-checked, not yet exercised against a live project.
//
// Cloud Run mounts Secret Manager versions as files, so this target uses file
// delivery and no credential enters the process environment. It has no durable
// per-instance volume: services that spill audit evidence to disk keep it only
// for the life of the instance.

import { stringify } from 'yaml'

const appOrder = ['sts', 'audit', 'coordinator', 'api', 'gateway', 'web']

const secretVolume = 'runtime-secrets'
const stateVolume = 'state'

function fail(message) {
  throw new Error(`gcpCloudRun: ${message}`)
}

function requireGcp(config) {
  const gcp = config.gcp ?? {}
  for (const key of ['project', 'region', 'serviceAccount']) {
    if (!gcp[key]) fail(`gcp.${key} is required`)
  }
  return gcp
}

// Cloud Run allows a continuous CPU range but ties a memory floor to it. The
// neutral topology already sits inside those bounds; this rejects anything that
// would be refused at deploy time.
function resources({ cpu, memory }) {
  const gib = Number(String(memory).replace(/Gi$/, ''))
  if (cpu > 8) fail(`resources ${cpu} vCPU exceeds the 8 vCPU Cloud Run ceiling`)
  if (gib > 32) fail(`resources ${memory} exceeds the 32Gi Cloud Run ceiling`)
  if (cpu >= 4 && gib < 2) fail(`resources ${cpu} vCPU requires at least 2Gi`)
  return { cpu: String(cpu), memory: `${gib}Gi` }
}

function secretRef(gcp, key) {
  return `${gcp.secretPrefix ?? 'caracal'}-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
}

function volumes(plan, gcp, unit) {
  const list = []
  if (unit.secretFiles.length > 0) {
    list.push({
      name: secretVolume,
      secret: {
        items: unit.secretFiles.map((key) => ({
          path: key,
          secret: secretRef(gcp, key),
          version: 'latest',
        })),
      },
    })
  }
  // Cloud Run offers no durable per-instance disk, so state is always in-memory.
  if (unit.state) list.push({ name: stateVolume, emptyDir: { medium: 'MEMORY', sizeLimit: '512Mi' } })
  return list
}

function volumeMounts(plan, unit) {
  const mounts = []
  if (unit.secretFiles.length > 0) mounts.push({ name: secretVolume, mountPath: plan.secretMountPath })
  if (unit.state) mounts.push({ name: stateVolume, mountPath: plan.statePath })
  return mounts
}

function containerSpec(plan, gcp, unit, extra = {}) {
  const spec = {
    image: unit.image,
    command: [unit.command],
    args: unit.args,
    env: Object.entries(unit.env).map(([name, value]) => ({ name, value: String(value) })),
    resources: { limits: resources(unit.resources) },
    volumeMounts: volumeMounts(plan, unit),
    ...extra,
  }
  return Object.fromEntries(Object.entries(spec).filter(([, value]) => !Array.isArray(value) || value.length > 0))
}

function renderService(plan, config, gcp, service) {
  return stringify({
    apiVersion: 'serving.knative.dev/v1',
    kind: 'Service',
    metadata: {
      name: `caracal-${service.name}`,
      annotations: {
        // Only the browser tier and the externally verified endpoints leave the project.
        'run.googleapis.com/ingress': service.exposure === 'public' ? 'all' : 'internal',
      },
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            'autoscaling.knative.dev/minScale': String(service.scale.min),
            'autoscaling.knative.dev/maxScale': String(service.scale.max),
          },
        },
        spec: {
          serviceAccountName: gcp.serviceAccount,
          containerConcurrency: service.scale.concurrentRequests,
          timeoutSeconds: 300,
          containers: [
            containerSpec(plan, gcp, service, {
              ports: [{ name: 'http1', containerPort: service.port }],
              startupProbe: {
                httpGet: { path: service.probes.startup, port: service.port },
                periodSeconds: 5,
                failureThreshold: 30,
              },
              livenessProbe: {
                httpGet: { path: service.probes.liveness, port: service.port },
                periodSeconds: 10,
              },
            }),
          ],
          volumes: volumes(plan, gcp, service),
        },
      },
    },
  })
}

function renderJob(plan, config, gcp, job) {
  return stringify({
    apiVersion: 'run.googleapis.com/v1',
    kind: 'Job',
    metadata: { name: `caracal-${job.name.toLowerCase()}` },
    spec: {
      template: {
        spec: {
          parallelism: 1,
          taskCount: 1,
          template: {
            spec: {
              serviceAccountName: gcp.serviceAccount,
              maxRetries: 3,
              timeoutSeconds: 900,
              containers: [containerSpec(plan, gcp, job)],
              volumes: volumes(plan, gcp, job),
            },
          },
        },
      },
    },
  })
}

function render(plan, config) {
  const gcp = requireGcp(config)
  const files = {}

  plan.jobs.forEach((job, index) => {
    files[`${10 + index}-job-${job.name.toLowerCase()}.yaml`] = renderJob(plan, config, gcp, job)
  })

  const ordered = [...plan.services].sort((a, b) => appOrder.indexOf(a.name) - appOrder.indexOf(b.name))
  ordered.forEach((service, index) => {
    files[`${20 + index}-app-${service.name}.yaml`] = renderService(plan, config, gcp, service)
  })

  files['secrets.txt'] = `${plan.secretKeys.map((key) => secretRef(gcp, key)).join('\n')}\n`
  return files
}

// Cloud Run gives every service a stable per-region URL; internal ingress keeps
// it reachable only from within the project's network.
function internalUrl(service, config) {
  const gcp = config.gcp ?? {}
  if (!gcp.project || !gcp.region) fail('gcp.project and gcp.region are required to derive internal service URLs')
  return `https://caracal-${service.name}-${gcp.projectNumber ?? gcp.project}.${gcp.region}.run.app`
}

export const gcpCloudRun = { secretDelivery: 'file', experimental: true, internalUrl, render }
