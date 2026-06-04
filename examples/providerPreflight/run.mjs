/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

CLI entry that resolves a resource, its provider, and an active policy decision from the Caracal Admin API, then runs the provider preflight checks.
*/

import { resolve4, resolve6 } from "node:dns/promises";
import { connect } from "node:net";
import { runProviderPreflight } from "./preflight.mjs";

const PROBE_TIMEOUT_MS = 5000;

function env(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

async function adminGet(apiUrl, token, path) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function adminPost(apiUrl, token, path, body) {
  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function resolveHost(host) {
  const results = await Promise.allSettled([resolve4(host), resolve6(host)]);
  const addresses = [];
  for (const r of results) if (r.status === "fulfilled") addresses.push(...r.value);
  return addresses;
}

function probeOrigin(origin) {
  return new Promise((resolveProbe) => {
    let host;
    let port;
    try {
      const url = new URL(origin);
      host = url.hostname;
      port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    } catch (err) {
      resolveProbe({ reachable: false, detail: err.message });
      return;
    }
    const socket = connect({ host, port, timeout: PROBE_TIMEOUT_MS });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveProbe(result);
    };
    socket.on("connect", () => finish({ reachable: true, detail: `tcp ${host}:${port}` }));
    socket.on("error", (err) => finish({ reachable: false, detail: err.message }));
    socket.on("timeout", () => finish({ reachable: false, detail: `timeout after ${PROBE_TIMEOUT_MS}ms` }));
  });
}

async function loadSimulation(apiUrl, token, zoneId, resource) {
  const sets = await adminGet(apiUrl, token, `/v1/zones/${zoneId}/policy-sets`);
  const active = sets.find((s) => s.active_version_id);
  if (!active) return undefined;
  const input = {
    application: { id: env("PREFLIGHT_APPLICATION_ID") },
    principal: { id: env("PREFLIGHT_PRINCIPAL_ID", env("PREFLIGHT_APPLICATION_ID")) },
    resource: { identifier: resource.identifier },
    context: { requested_scopes: env("PREFLIGHT_SCOPES").split(",").map((s) => s.trim()) },
  };
  return adminPost(apiUrl, token, `/v1/zones/${zoneId}/policy-sets/${active.id}/simulate`, {
    version_id: active.active_version_id,
    input,
  });
}

async function main() {
  const apiUrl = env("CARACAL_API_URL", "http://127.0.0.1:3000").replace(/\/$/, "");
  const token = env("CARACAL_ADMIN_TOKEN");
  const zoneId = env("PREFLIGHT_ZONE_ID");
  const resourceId = env("PREFLIGHT_RESOURCE_ID");
  const requireInjection = process.env.PREFLIGHT_REQUIRE_RUNTIME_INJECTION === "true";

  const resource = await adminGet(apiUrl, token, `/v1/zones/${zoneId}/resources/${resourceId}`);
  const provider = resource.credential_provider_id
    ? await adminGet(apiUrl, token, `/v1/zones/${zoneId}/providers/${resource.credential_provider_id}`).catch(() => undefined)
    : undefined;
  const simulation = await loadSimulation(apiUrl, token, zoneId, resource);

  const report = await runProviderPreflight({
    resource,
    provider,
    resolveHost,
    probeOrigin,
    requireInjection,
    simulation,
  });

  for (const c of report.checks) {
    const mark = c.status === "ok" ? "PASS" : c.status === "warn" ? "WARN" : "FAIL";
    process.stdout.write(`[${mark}] ${c.check}: ${c.detail}\n`);
  }
  process.stdout.write(`\n${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`provider preflight error: ${err.message}\n`);
  process.exit(2);
});
