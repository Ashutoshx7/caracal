# deploy

## Scope

- Covers deployment configurations for Caracal's own hosted environments under `deploy/<provider>/<environment>.yaml`.

## Architecture Design

- Each file is the deployment configuration for one environment, consumed by `infra/containerPlatform/render.mjs` through the `deployAzure` workflow.
- Behaviour-changing settings are committed so a pull request shows them; addresses and identities are `${VARIABLE}` placeholders resolved from the GitHub environment at deploy time.
- Long-lived infrastructure is out of scope: the resource group, network, PostgreSQL, Redis, Key Vault, registry, Container Apps environment, and monitoring are created once and outlive every deployment.

## Required

- Must keep `mode: stable` for any environment that serves real traffic.
- Must express every account-identifying value as a `${VARIABLE}` placeholder.
- Must leave `release.version` as a placeholder value; the workflow sets it from the version being deployed.
- Must name a file after the environment it deploys, matching the workflow's environment input.

## Forbidden

- Must not contain credentials, connection strings, or key material; secrets are referenced from the provider secret manager.
- Must not contain a subscription ID, tenant ID, resource ID, hostname, or vault URL in literal form.
- Must not describe long-lived infrastructure.
- Must not duplicate service topology; that lives in `infra/containerPlatform/topology.yaml`.

## Validation

- `node infra/containerPlatform/render.mjs --config <file> --out <dir>` after substitution rejects an incomplete or unsafe configuration.
