/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file declares the control-plane data shapes the web client consumes over the console backend.
*/
export type RegistrationMethod = "managed" | "dcr";

export interface Zone {
  id: string;
  name: string;
  slug: string;
  dcr_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZoneInput {
  name: string;
  slug?: string;
  dcr_enabled?: boolean;
}

export interface Application {
  id: string;
  zone_id: string;
  name: string;
  registration_method: RegistrationMethod;
  traits?: string[];
  expires_at?: string | null;
  client_secret?: string;
  created_at: string;
}

export interface ApplicationInput {
  name: string;
  registration_method: "managed";
  traits?: string[];
}

export type ResourceOperationEnforcement = "enforced" | "transport_uniform";

export interface ResourceOperation {
  method: string;
  path: string;
  scope: string;
}

export interface Resource {
  id: string;
  zone_id: string;
  name: string;
  identifier: string;
  upstream_url: string | null;
  gateway_application_id: string | null;
  scopes: string[];
  credential_provider_id: string | null;
  operations: ResourceOperation[];
  operation_enforcement: ResourceOperationEnforcement;
  created_at: string;
  updated_at: string;
}

export type ProviderKind =
  | "none"
  | "caracal_mandate"
  | "oauth2_authorization_code"
  | "oauth2_client_credentials"
  | "api_key"
  | "bearer_token";

export interface Provider {
  id: string;
  zone_id: string;
  name: string;
  kind: ProviderKind;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: string;
  zone_id: string;
  name: string;
  description: string | null;
  owner_type: string;
  created_by: string;
  created_at: string;
}

export interface PolicySet {
  id: string;
  zone_id: string;
  name: string;
  description: string | null;
  active_version_id: string | null;
  created_at: string;
}

export interface ConsoleStatus {
  configured: boolean;
  reachable: boolean;
  apiUrl: string;
}
