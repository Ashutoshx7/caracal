// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Azure Container Apps target: maps the neutral Caracal plan onto Container Apps and Jobs manifests.

import { stringify } from 'yaml'

// Rollout order: dependencies first, browser tier last, so a service is reachable
// before the services that call it are updated to point at it.
const appOrder = ['sts', 'audit', 'coordinator', 'api', 'gateway', 'web']

const secretVolume = 'runtime-secrets'
const stateVolume = 'state'

function fail(message) {
  throw new Error(`azureContainerApps: ${message}`)
}

// Container Apps secret names accept lower-case alphanumerics and hyphens only,
// while the services read camelCase filenames. The volume's per-secret path keeps
// the file name the service expects, so neither side has to change.
function secretName(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function subscriptionOf(identityId) {
  const match = /^\/subscriptions\/([^/]+)\//.exec(identityId ?? '')
  if (!match) fail('azure.identityId must be a full user-assigned identity resource ID')
  return match[1]
}

function requireAzure(config) {
  const azure = config.azure ?? {}
  for (const key of ['resourceGroup', 'location', 'environmentName', 'environmentDomain', 'identityId', 'keyVaultUrl']) {
    if (!azure[key]) fail(`azure.${key} is required`)
  }
  return azure
}

// Consumption workload profiles only accept a fixed vCPU-to-memory ladder, and a
// mismatch is rejected at deploy time rather than at render time.
function resources({ cpu, memory }) {
  const gib = Number(String(memory).replace(/Gi$/, ''))
  if (!Number.isFinite(gib) || gib !== cpu * 2) {
    fail(`resources ${cpu} vCPU / ${memory} is not a valid Container Apps pair; memory must be ${cpu * 2}Gi`)
  }
  if (cpu > 4) fail(`resources ${cpu} vCPU exceeds the 4 vCPU Container Apps ceiling`)
  return { cpu, memory: `${gib}Gi` }
}

function envList(env, envSecrets) {
  return [
    ...Object.entries(env).map(([name, value]) => ({ name, value: String(value) })),
    ...Object.entries(envSecrets).map(([name, key]) => ({ name, secretRef: secretName(key) })),
  ]
}

function secretRefs(azure, keys) {
  return keys.map((key) => ({
    name: secretName(key),
    keyVaultUrl: `${azure.keyVaultUrl.replace(/\/$/, '')}/secrets/${secretName(key)}`,
    identity: azure.identityId,
  }))
}

function volumes(plan, azure, unit) {
  const list = []
  if (unit.secretFiles.length > 0) {
    list.push({
      name: secretVolume,
      storageType: 'Secret',
      secrets: unit.secretFiles.map((key) => ({ secretRef: secretName(key), path: key })),
    })
  }
  if (unit.state) {
    // The audit spill path fsyncs each file and its parent directory. SMB shares
    // do not reliably honor that, and a failed fsync is accounted as lost
    // evidence, so a durable share here must be NFS.
    list.push(
      azure.stateStorageName
        ? { name: stateVolume, storageType: 'NfsAzureFile', storageName: azure.stateStorageName }
        : { name: stateVolume, storageType: 'EmptyDir' },
    )
  }
  return list
}

function volumeMounts(plan, unit) {
  const mounts = []
  if (unit.secretFiles.length > 0) {
    mounts.push({ volumeName: secretVolume, mountPath: plan.secretMountPath })
  }
  if (unit.state) mounts.push({ volumeName: stateVolume, mountPath: plan.statePath })
  return mounts
}

function probes(service) {
  return [
    {
      type: 'startup',
      httpGet: { path: service.probes.startup, port: service.port },
      periodSeconds: 5,
      failureThreshold: 30,
    },
    {
      type: 'liveness',
      httpGet: { path: service.probes.liveness, port: service.port },
      initialDelaySeconds: 10,
      periodSeconds: 10,
    },
    {
      type: 'readiness',
      httpGet: { path: service.probes.readiness, port: service.port },
      initialDelaySeconds: 10,
      periodSeconds: 10,
    },
  ]
}

function identity(azure) {
  return { type: 'UserAssigned', userAssignedIdentities: { [azure.identityId]: {} } }
}

function registries(config, azure) {
  return [{ server: config.release.registry, identity: azure.identityId }]
}

// An empty array reads as a declared-but-unused setting, so omit it instead.
function compact(node) {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => !Array.isArray(value) || value.length > 0))
}

function renderApp(plan, config, azure, environmentId, service) {
  return stringify({
    location: azure.location,
    identity: identity(azure),
    properties: {
      managedEnvironmentId: environmentId,
      configuration: {
        activeRevisionsMode: 'Single',
        registries: registries(config, azure),
        secrets: secretRefs(azure, [...service.secretFiles, ...Object.values(service.envSecrets)]),
        ingress: {
          external: service.exposure === 'public',
          targetPort: service.port,
          transport: 'auto',
          allowInsecure: false,
          traffic: [{ latestRevision: true, weight: 100 }],
        },
      },
      template: compact({
        containers: [
          compact({
            name: service.name,
            image: service.image,
            command: [service.command],
            args: service.args,
            env: envList(service.env, service.envSecrets),
            resources: resources(service.resources),
            volumeMounts: volumeMounts(plan, service),
            probes: probes(service),
          }),
        ],
        scale: {
          minReplicas: service.scale.min,
          maxReplicas: service.scale.max,
          rules: [
            {
              name: 'http',
              http: { metadata: { concurrentRequests: String(service.scale.concurrentRequests) } },
            },
          ],
        },
        volumes: volumes(plan, azure, service),
      }),
    },
  })
}

function renderJob(plan, config, azure, environmentId, job) {
  return stringify({
    location: azure.location,
    identity: identity(azure),
    properties: {
      environmentId,
      configuration: {
        triggerType: 'Manual',
        replicaTimeout: 900,
        replicaRetryLimit: 3,
        manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 },
        registries: registries(config, azure),
        secrets: secretRefs(azure, [...job.secretFiles, ...Object.values(job.envSecrets)]),
      },
      template: compact({
        containers: [
          compact({
            name: job.name.toLowerCase(),
            image: job.image,
            command: [job.command],
            args: job.args,
            env: envList(job.env, job.envSecrets),
            resources: resources(job.resources),
            volumeMounts: volumeMounts(plan, job),
          }),
        ],
        volumes: volumes(plan, azure, job),
      }),
    },
  })
}

function render(plan, config) {
  const azure = requireAzure(config)
  const environmentId =
    `/subscriptions/${subscriptionOf(azure.identityId)}/resourceGroups/${azure.resourceGroup}` +
    `/providers/Microsoft.App/managedEnvironments/${azure.environmentName}`

  const files = {}
  plan.jobs.forEach((job, index) => {
    files[`${10 + index}-job-${job.name.toLowerCase()}.yaml`] = renderJob(plan, config, azure, environmentId, job)
  })

  const ordered = [...plan.services].sort((a, b) => appOrder.indexOf(a.name) - appOrder.indexOf(b.name))
  ordered.forEach((service, index) => {
    files[`${20 + index}-app-${service.name}.yaml`] = renderApp(plan, config, azure, environmentId, service)
  })

  files['secrets.txt'] = `${plan.secretKeys.map(secretName).join('\n')}\n`
  return files
}

// Internal ingress publishes each app on the environment's private domain, which
// is how services address each other without leaving the environment.
function internalUrl(service, config) {
  const domain = config.azure?.environmentDomain
  if (!domain) fail('azure.environmentDomain is required to derive internal service URLs')
  return `https://${service.name}.internal.${domain}`
}

export const azureContainerApps = { secretDelivery: 'file', internalUrl, render }
