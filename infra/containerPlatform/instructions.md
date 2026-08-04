# infra/containerPlatform

## Scope

- Covers deployment onto managed container platforms that run stock OCI images without a cluster, under `infra/containerPlatform/`.

## Architecture Design

- `topology.yaml` is the single platform-neutral description of the Caracal deployment: images, start commands, ports, environment, secret bindings, probes, scaling, and one-shot jobs.
- `render.mjs` owns every platform-neutral concern: config validation, placeholder resolution, image references, secret-delivery selection, and plan assembly.
- `targets/` holds one adapter per platform. An adapter maps the rendered plan onto that platform's manifests and nothing else.
- `examples/` holds one deployment config per provider, carrying deployment identity and provider wiring only.
- `azureContainerApps` is the tested reference adapter and ships an ordered apply flow. `awsEcs` and `gcpCloudRun` are experimental: they render and validate, but have not been exercised against a live account and ship manifests only.
- `scripts/` owns render validation and any ordered apply flow.

## Required

- Must render services from the published multi-role images and select the role with the container start command.
- Must keep every platform-neutral fact in `topology.yaml` and every deployment-specific value in the deployment config.
- Must declare secrets as `secretEnv`, mapping a logical environment variable to the credential that supplies it, and let the adapter choose file or environment delivery.
- Must express provider secrets as references to an external secret manager.
- Must apply schema migration jobs to completion before any service revision rolls.
- Must implement an adapter as a module in `targets/` exporting `secretDelivery`, `internalUrl`, and `render`.
- Must set `experimental: true` on an adapter until it has been exercised against a live account.
- Must run `bash infra/containerPlatform/scripts/validate.sh` after any change in this tree.

## Forbidden

- Must not require a per-service or per-deployment container build.
- Must not put provider-specific values, names, or conditionals in `topology.yaml` or `render.mjs`.
- Must not name a `_FILE` environment variable in the topology; delivery is the adapter's decision.
- Must not emit a manifest containing literal credential material.
- Must not duplicate the Helm chart's values or restate service topology in an adapter.
- Must not commit a filled-in deployment config.

## Validation

- `bash infra/containerPlatform/scripts/validate.sh` renders every adapter and asserts image, secret, delivery, ingress, ordering, maturity, and configuration-guardrail invariants.
