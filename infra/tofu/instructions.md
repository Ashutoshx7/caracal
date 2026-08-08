# infra/tofu

## Scope

- Covers OpenTofu infrastructure provisioning for Caracal deployments under `infra/tofu/`.

## Architecture Design

- `modules/caracalStack/` is the Kubernetes unit: a pod-security-restricted namespace, optional externally managed runtime Secret, and the Caracal Helm release.
- `modules/caracalHost/` is the VM unit: provider-less cloud-init user data that installs Docker and the runtime CLI, then starts the pinned compose stack; callers attach the output to any VM resource on any cloud.
- `providers/<provider>/<model>/` holds the cloud adapters. They are the only place in this tree that names a provider's resources, and they translate a shared contract rather than restating the deployment.
- `envs/dev/` installs the working-tree chart with the chart's `values.dev.yaml`; `envs/production/` installs a pinned OCI-published chart version with the chart's `values.production.yaml`.
- `envs/azureHost/` composes the VM bootstrap with the Azure host adapter into one deployable host; it is the worked example of pairing a provider-agnostic module with a provider adapter.
- Chart profile values files remain the single source of deployment defaults; environment roots reference them with `file()` instead of duplicating their content.
- Cluster access is provider-injected and kubeconfig-based by default so roots stay portable across EKS, GKE, AKS, and self-hosted clusters.

## Required

- Must pin `required_version` for OpenTofu and version constraints for every provider.
- Must keep modules provider-agnostic: providers are configured only in environment roots.
- Must route runtime credentials through the `runtimeSecrets` variable or an external secret manager, never through chart plaintext values.
- Must keep `modules/caracalHost` free of provider requirements and secret inputs; VM hosts generate their own runtime secrets at first start.
- Must derive the console origin and token issuer from the host's TLS proxy routes so a public name and its advertised origin cannot diverge.
- Must keep production roots pinned to released chart versions from the OCI registry.
- Must run `bash infra/tofu/scripts/validate.sh` after any change in this tree.

## Forbidden

- Must not commit `terraform.tfvars`, state files, lock data with credentials, or any secret material.
- Must not duplicate chart values profiles into HCL; reference the chart's values files instead.
- Must not add cloud-provider-specific resources to modules; provider-specific concerns live in `providers/`, environment roots, or caller configurations.

## Validation

- `bash infra/tofu/scripts/validate.sh` runs `tofu fmt -check`, an offline `tofu validate` of every environment root and module, provider-schema validation and contract conformance for every adapter, and a render of the `caracalHost` cloud-config with and without a TLS proxy.
