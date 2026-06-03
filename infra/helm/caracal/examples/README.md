# Caracal cloud reference examples

Opt-in reference artifacts for production Kubernetes deployments. The core chart
stays cloud-agnostic; everything here is an example you copy and adapt. The
per-cloud surface is isolated to secret-store authentication, storage class, and
ingress annotations.

See the walkthrough in the docs: **Operations → Cloud Reference Deployments**.

## Contents

| Path | Purpose |
| --- | --- |
| `values.cloud-managed.yaml` | Production overlay: stable mode, externalized managed Postgres/Redis, cert-manager TLS ingress, ServiceMonitor, tightened egress. |
| `external-secrets/secretstore-aws.yaml` | External Secrets Operator store for AWS Secrets Manager (IRSA). |
| `external-secrets/secretstore-gcp.yaml` | External Secrets Operator store for Google Secret Manager (Workload Identity). |
| `external-secrets/secretstore-azure.yaml` | External Secrets Operator store for Azure Key Vault (Workload Identity). |
| `external-secrets/externalsecret-runtime.yaml` | Cloud-agnostic ExternalSecret that materializes the `caracal-runtime` Secret with the exact keys the chart mounts. |

## Apply order

1. Install the [External Secrets Operator](https://external-secrets.io/) and
   [cert-manager](https://cert-manager.io/) in the cluster.
2. Store the Caracal secret material in your secret manager under the keys the
   `ExternalSecret` references (`caracal/postgres`, `caracal/redis`,
   `caracal/zone-kek`, `caracal/audit-hmac-key`, `caracal/streams-hmac-key`,
   `caracal/gateway-sts-hmac-key`, `caracal/admin-token`,
   `caracal/coordinator-token`, and the optional `*-admin-token` /
   `metrics-bearer`).
3. Apply the provider store and the ExternalSecret:

   ```bash
   kubectl apply -f external-secrets/secretstore-aws.yaml
   kubectl apply -f external-secrets/externalsecret-runtime.yaml
   ```

4. Install the chart with the overlay, substituting your managed endpoints:

   ```bash
   helm upgrade --install caracal ../ \
     --namespace caracal --create-namespace \
     -f values.cloud-managed.yaml \
     --set secrets.database.host=caracal-postgres.managed.example.com \
     --set secrets.redis.host=caracal-redis.managed.example.com
   ```

The chart consumes `caracal-runtime` because `secrets.create` stays `false`.
