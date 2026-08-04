// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// AWS ECS on Fargate target: maps the neutral Caracal plan onto task definitions and services.

// Experimental. Rendered and schema-checked, not yet exercised against a live account.
//
// ECS cannot project a secret onto a filesystem, so this target declares
// environment delivery and the core binds each credential to its plain variable
// instead of its _FILE form. The values are resolved by the agent at task start
// and never appear in the task definition, but they are visible to any principal
// holding ecs:DescribeTasks on the cluster; scope that permission accordingly.

const appOrder = ['sts', 'audit', 'coordinator', 'api', 'gateway', 'web']

function fail(message) {
  throw new Error(`awsEcs: ${message}`)
}

function requireAws(config) {
  const aws = config.aws ?? {}
  for (const key of ['region', 'accountId', 'cluster', 'executionRoleArn', 'taskRoleArn', 'subnetIds', 'securityGroupIds', 'namespaceArn']) {
    if (!aws[key] || (Array.isArray(aws[key]) && aws[key].length === 0)) fail(`aws.${key} is required`)
  }
  return aws
}

// Fargate accepts a fixed set of CPU units and a memory range per size. Rendering
// an unsupported pair fails at RegisterTaskDefinition, so it is rejected here.
function resources({ cpu, memory }) {
  const units = Math.round(cpu * 1024)
  const mib = Math.round(Number(String(memory).replace(/Gi$/, '')) * 1024)
  if (![256, 512, 1024, 2048, 4096, 8192, 16384].includes(units)) {
    fail(`resources ${cpu} vCPU is not a Fargate task size`)
  }
  return { cpu: String(units), memory: String(mib) }
}

function secretArn(aws, key) {
  return `arn:aws:secretsmanager:${aws.region}:${aws.accountId}:secret:${aws.secretPrefix ?? 'caracal'}/${key}`
}

function container(plan, aws, unit, extra = {}) {
  return {
    name: unit.name.toLowerCase(),
    image: unit.image,
    essential: true,
    entryPoint: [unit.command],
    command: unit.args,
    environment: Object.entries(unit.env).map(([name, value]) => ({ name, value: String(value) })),
    secrets: Object.entries(unit.envSecrets).map(([name, key]) => ({ name, valueFrom: secretArn(aws, key) })),
    logConfiguration: {
      logDriver: 'awslogs',
      options: {
        'awslogs-group': `/caracal/${unit.name.toLowerCase()}`,
        'awslogs-region': aws.region,
        'awslogs-stream-prefix': 'caracal',
        'awslogs-create-group': 'true',
      },
    },
    ...extra,
  }
}

function taskDefinition(plan, config, aws, unit, extra = {}) {
  return JSON.stringify(
    {
      family: unit.resourceName,
      requiresCompatibilities: ['FARGATE'],
      networkMode: 'awsvpc',
      runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
      executionRoleArn: aws.executionRoleArn,
      taskRoleArn: aws.taskRoleArn,
      ...resources(unit.resources),
      containerDefinitions: [container(plan, aws, unit, extra)],
    },
    null,
    2,
  )
}

function renderService(plan, config, aws, service) {
  const healthCheck = {
    command: ['CMD', '/healthcheck'],
    interval: 10,
    timeout: 3,
    retries: 3,
    startPeriod: 30,
  }
  const definition = taskDefinition(plan, config, aws, service, {
    portMappings: [
      { containerPort: service.port, protocol: 'tcp', name: service.resourceName, appProtocol: 'http' },
    ],
    healthCheck,
    environment: [
      ...Object.entries(service.env).map(([name, value]) => ({ name, value: String(value) })),
      // The image's probe binary reads these to target this service's readiness route.
      { name: 'HEALTH_PATH', value: service.probes.readiness },
      { name: 'HEALTH_HOST', value: '127.0.0.1' },
    ],
  })

  // Service Connect gives every service a stable in-cluster name, which is what
  // the neutral internal URLs resolve to.
  const serviceSpec = {
    cluster: aws.cluster,
    serviceName: service.resourceName,
    taskDefinition: service.resourceName,
    launchType: 'FARGATE',
    desiredCount: service.scale.min,
    propagateTags: 'SERVICE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: aws.subnetIds,
        securityGroups: aws.securityGroupIds,
        assignPublicIp: 'DISABLED',
      },
    },
    serviceConnectConfiguration: {
      enabled: true,
      namespace: aws.namespaceArn,
      services: [
        {
          portName: service.resourceName,
          discoveryName: service.resourceName,
          clientAliases: [{ port: service.port, dnsName: service.resourceName }],
        },
      ],
    },
    deploymentConfiguration: {
      minimumHealthyPercent: 100,
      maximumPercent: 200,
      deploymentCircuitBreaker: { enable: true, rollback: true },
    },
  }

  if (service.exposure === 'public') {
    const targetGroup = aws.targetGroupArns?.[service.name]
    if (!targetGroup) fail(`aws.targetGroupArns.${service.name} is required for a public service`)
    serviceSpec.loadBalancers = [
      { targetGroupArn: targetGroup, containerName: service.name, containerPort: service.port },
    ]
    serviceSpec.healthCheckGracePeriodSeconds = 60
  }

  return { definition, service: JSON.stringify(serviceSpec, null, 2) }
}

function render(plan, config) {
  const aws = requireAws(config)
  const files = {}

  plan.jobs.forEach((job, index) => {
    const name = job.name.toLowerCase()
    files[`${10 + index}-job-${name}.json`] = taskDefinition(plan, config, aws, job)
  })

  const ordered = [...plan.services].sort((a, b) => appOrder.indexOf(a.name) - appOrder.indexOf(b.name))
  ordered.forEach((service, index) => {
    const { definition, service: spec } = renderService(plan, config, aws, service)
    files[`${20 + index}-app-${service.name}.json`] = definition
    files[`${20 + index}-app-${service.name}.service.json`] = spec
  })

  files['secrets.txt'] = `${plan.secretKeys.map((key) => `${aws.secretPrefix ?? 'caracal'}/${key}`).join('\n')}\n`
  return files
}

// Service Connect resolves a service by its client alias inside the cluster,
// which is set to the same name the service is deployed under.
function internalUrl(service) {
  return `http://${service.resourceName}:${service.port}`
}

export const awsEcs = { secretDelivery: 'env', experimental: true, internalUrl, render }
