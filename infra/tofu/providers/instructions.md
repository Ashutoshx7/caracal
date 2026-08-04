# infra/tofu/providers

## Scope

- Covers cloud provider adapters for the deployment models under `infra/tofu/providers/<provider>/<model>/`.

## Architecture Design

- `modules/` holds the provider-agnostic core; this tree holds the only OpenTofu code that names a cloud provider's resources.
- Each `<provider>/host/` adapter implements the host contract: one instance running the core's cloud-init, its inbound exposure, its cloud identity, and its DNS records.
- `azure/` is the tested reference adapter. `aws/` and `gcp/` are experimental: schema-validated, not yet exercised against a live account.

## Required

- Must expose the shared contract inputs: `name`, `region`, `machineSize`, `diskGb`, `userData`, `adminUsername`, `adminPublicKey`, `ingressCidrs`, `adminCidrs`, `networkCidr`, `dnsZone`, `hostnames`, `dnsTtl`, `tags`.
- Must expose the shared contract outputs: `publicIp`, `hostId`, `identityId`, `hostnames`.
- Must group provider-only inputs after the shared contract, under a comment naming the provider.
- Must pin `required_version` and a version constraint for the single provider it adapts.
- Must accept cloud-init from the core rather than generating host configuration.
- Must open inbound 80 alongside 443 so certificate issuance can answer its challenge.
- Must mark a new adapter experimental until it has been exercised against a live account.
- Must run `bash infra/tofu/scripts/validate.sh` after any change in this tree.

## Forbidden

- Must not require a provider other than the one it adapts.
- Must not accept secret material as an input.
- Must not rename, add, or omit a contract input or output.
- Must not embed Caracal configuration; the deployment shape belongs to the core.
- Must not create databases, caches, registries, or clusters; adapters cover one deployment model only.

## Validation

- `bash infra/tofu/scripts/validate.sh` validates every adapter against its real provider schema and asserts host contract conformance.
