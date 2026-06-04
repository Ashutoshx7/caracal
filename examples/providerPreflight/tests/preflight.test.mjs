/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Offline tests for the provider preflight check functions and orchestrator.
*/

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkBinding,
  checkCallbackReachable,
  checkPolicyDecision,
  checkRuntimeInjection,
  checkTokenEndpointHost,
  checkUpstreamReachable,
  isPrivateAddress,
  runProviderPreflight,
} from "../preflight.mjs";

const reachable = async () => ({ reachable: true, detail: "tcp ok" });
const unreachable = async () => ({ reachable: false, detail: "ECONNREFUSED" });
const publicDns = async () => ["93.184.216.34"];
const privateDns = async () => ["10.1.2.3"];

test("isPrivateAddress classifies ranges", () => {
  assert.equal(isPrivateAddress("10.0.0.1"), true);
  assert.equal(isPrivateAddress("192.168.1.1"), true);
  assert.equal(isPrivateAddress("172.16.0.1"), true);
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("93.184.216.34"), false);
});

test("binding requires a credential provider", () => {
  assert.equal(checkBinding({ identifier: "resource://x" }, undefined).status, "fail");
  const resource = { credential_provider_id: "p1", gateway_application_id: "app1" };
  const provider = { identifier: "provider://x", kind: "api_key" };
  assert.equal(checkBinding(resource, provider).status, "ok");
});

test("binding warns without a gateway application", () => {
  const resource = { credential_provider_id: "p1" };
  const provider = { identifier: "provider://x", kind: "api_key" };
  assert.equal(checkBinding(resource, provider).status, "warn");
});

test("token endpoint host rejects private resolution", async () => {
  const provider = { kind: "oauth2_client_credentials", config_json: { token_endpoint: "https://oauth.example.com/token" } };
  assert.equal((await checkTokenEndpointHost(provider, privateDns)).status, "fail");
  assert.equal((await checkTokenEndpointHost(provider, publicDns)).status, "ok");
});

test("token endpoint host skips non-oauth providers", async () => {
  const provider = { kind: "api_key", config_json: {} };
  assert.equal((await checkTokenEndpointHost(provider, privateDns)).status, "ok");
});

test("callback reachability needs https and a reachable origin", async () => {
  const httpProvider = { kind: "oauth2_authorization_code", config_json: { redirect_uri: "http://cb.example.com/cb" } };
  assert.equal((await checkCallbackReachable(httpProvider, reachable)).status, "fail");
  const httpsProvider = { kind: "oauth2_authorization_code", config_json: { redirect_uri: "https://cb.example.com/cb" } };
  assert.equal((await checkCallbackReachable(httpsProvider, reachable)).status, "ok");
  assert.equal((await checkCallbackReachable(httpsProvider, unreachable)).status, "fail");
});

test("upstream reachability warns when no upstream is set", async () => {
  assert.equal((await checkUpstreamReachable({}, reachable)).status, "warn");
  assert.equal((await checkUpstreamReachable({ upstream_url: "https://api.example.com" }, reachable)).status, "ok");
  assert.equal((await checkUpstreamReachable({ upstream_url: "https://api.example.com" }, unreachable)).status, "fail");
});

test("runtime injection enforces the provider flag", () => {
  const provider = { identifier: "provider://x", config_json: { allow_runtime_injection: true } };
  assert.equal(checkRuntimeInjection(provider, true).status, "ok");
  assert.equal(checkRuntimeInjection({ identifier: "provider://y", config_json: {} }, true).status, "fail");
  assert.equal(checkRuntimeInjection(provider, false).status, "ok");
});

test("policy decision passes only on allow", () => {
  assert.equal(checkPolicyDecision({ result: { decision: "allow" } }).status, "ok");
  assert.equal(checkPolicyDecision({ result: { decision: "deny" } }).status, "fail");
  assert.equal(checkPolicyDecision(undefined).status, "fail");
});

test("runProviderPreflight aggregates and fails closed", async () => {
  const resource = { identifier: "resource://x", credential_provider_id: "p1", gateway_application_id: "app1", upstream_url: "https://api.example.com" };
  const provider = { identifier: "provider://x", kind: "api_key", config_json: { allow_runtime_injection: true } };
  const report = await runProviderPreflight({
    resource,
    provider,
    resolveHost: publicDns,
    probeOrigin: reachable,
    requireInjection: true,
    simulation: { result: { decision: "allow" } },
  });
  assert.equal(report.passed, true);
  assert.equal(report.summary.fail, 0);

  const denied = await runProviderPreflight({
    resource,
    provider,
    resolveHost: publicDns,
    probeOrigin: reachable,
    requireInjection: true,
    simulation: { result: { decision: "deny" } },
  });
  assert.equal(denied.passed, false);
});
