/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Provider preflight checks that validate a resource, its provider binding, and the policy that authorizes it before the first Gateway call.
*/

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

export function isPrivateAddress(address) {
  if (!address) return true;
  if (address === "::1" || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd")) return true;
  if (address.startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  return PRIVATE_V4.some((re) => re.test(address));
}

function ok(check, detail) {
  return { check, status: "ok", detail };
}
function warn(check, detail) {
  return { check, status: "warn", detail };
}
function fail(check, detail) {
  return { check, status: "fail", detail };
}

const OAUTH_KINDS = new Set(["oauth2_authorization_code", "oauth2_client_credentials"]);

export function checkBinding(resource, provider) {
  if (!resource) return fail("resource binding", "resource not found");
  if (!resource.credential_provider_id) {
    return fail("resource binding", "resource has no credential_provider_id; bind exactly one provider");
  }
  if (!provider) {
    return fail("resource binding", `credential_provider_id ${resource.credential_provider_id} does not resolve to a provider`);
  }
  if (!resource.gateway_application_id) {
    return warn("resource binding", "no gateway_application_id; Gateway-mediated routing needs an application identity");
  }
  return ok("resource binding", `bound to ${provider.identifier} (${provider.kind})`);
}

export async function checkTokenEndpointHost(provider, resolveHost) {
  if (!provider || !OAUTH_KINDS.has(provider.kind)) {
    return ok("token endpoint host", "not an OAuth provider; skipped");
  }
  const endpoint = provider.config_json?.token_endpoint;
  if (!endpoint) return fail("token endpoint host", "OAuth provider has no token_endpoint");
  let host;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return fail("token endpoint host", `token_endpoint must be HTTPS: ${endpoint}`);
    host = url.hostname;
  } catch {
    return fail("token endpoint host", `token_endpoint is not a valid URL: ${endpoint}`);
  }
  try {
    const addresses = await resolveHost(host);
    if (addresses.length === 0) return fail("token endpoint host", `${host} does not resolve`);
    const privateHit = addresses.find((a) => isPrivateAddress(a));
    if (privateHit) return fail("token endpoint host", `${host} resolves to private address ${privateHit}; STS requires a public token endpoint`);
    return ok("token endpoint host", `${host} resolves to public address(es)`);
  } catch (err) {
    return fail("token endpoint host", `${host} resolution failed: ${err.message}`);
  }
}

export async function checkCallbackReachable(provider, probe) {
  if (!provider || provider.kind !== "oauth2_authorization_code") {
    return ok("callback reachability", "no authorization-code callback; skipped");
  }
  const redirect = provider.config_json?.redirect_uri;
  if (!redirect) return fail("callback reachability", "authorization-code provider has no redirect_uri");
  let url;
  try {
    url = new URL(redirect);
  } catch {
    return fail("callback reachability", `redirect_uri is not a valid URI: ${redirect}`);
  }
  if (url.protocol !== "https:") {
    return fail("callback reachability", `redirect_uri must be HTTPS so providers can return the browser: ${redirect}`);
  }
  const reach = await probe(url.origin);
  if (!reach.reachable) return fail("callback reachability", `${url.origin} not reachable: ${reach.detail}`);
  return ok("callback reachability", `${url.origin} reachable (${reach.detail})`);
}

export async function checkUpstreamReachable(resource, probe) {
  const upstream = resource?.upstream_url;
  if (!upstream) return warn("upstream reachability", "resource has no upstream_url; connector-verified or mandate-only resources may not need one");
  let url;
  try {
    url = new URL(upstream);
  } catch {
    return fail("upstream reachability", `upstream_url is not a valid URL: ${upstream}`);
  }
  const reach = await probe(url.origin);
  if (!reach.reachable) return fail("upstream reachability", `${url.origin} not reachable from this host: ${reach.detail}`);
  return ok("upstream reachability", `${url.origin} reachable from this host (${reach.detail})`);
}

export function checkRuntimeInjection(provider, requireInjection) {
  if (!requireInjection) return ok("runtime injection", "not requested; skipped");
  if (!provider) return fail("runtime injection", "no provider to evaluate");
  const allowed = provider.config_json?.allow_runtime_injection === true;
  if (!allowed) {
    return fail("runtime injection", `provider ${provider.identifier} does not set allow_runtime_injection=true`);
  }
  return ok("runtime injection", `provider ${provider.identifier} permits runtime token injection`);
}

export function checkPolicyDecision(simulation) {
  if (!simulation) return fail("policy authorization", "no active policy set simulated; activate a policy that allows this request");
  const decision = simulation.result?.decision;
  const status = simulation.result?.evaluation_status;
  if (decision === "allow") return ok("policy authorization", "active policy set allows the application, resource, and scopes");
  return fail("policy authorization", `active policy set returned ${decision ?? "no decision"} (${status ?? "unknown status"}); the request will be denied`);
}

export function summarize(checks) {
  const summary = { ok: 0, warn: 0, fail: 0, total: checks.length };
  for (const c of checks) summary[c.status] += 1;
  return { summary, passed: summary.fail === 0 };
}

export async function runProviderPreflight(input) {
  const { resource, provider, resolveHost, probeOrigin, requireInjection, simulation } = input;
  const checks = [];
  checks.push(checkBinding(resource, provider));
  checks.push(await checkTokenEndpointHost(provider, resolveHost));
  checks.push(await checkCallbackReachable(provider, probeOrigin));
  checks.push(await checkUpstreamReachable(resource, probeOrigin));
  checks.push(checkRuntimeInjection(provider, requireInjection));
  checks.push(checkPolicyDecision(simulation));
  return { checks, ...summarize(checks) };
}
