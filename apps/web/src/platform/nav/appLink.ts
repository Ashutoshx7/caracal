/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Reserved org ids and Console path building for the account/org/zone URL hierarchy.
*/
import { getProfile, getActiveZoneId } from "@/platform/state/localInstall";

// The Console URL is /:accountId/:orgId/:zoneId/app/...: account outermost as the stable human
// identity, org as the tenancy boundary, zone innermost. Open source has no orgs, so every account
// uses this reserved sentinel org; enterprise replaces it with real org ids on the same shape, so
// zone and account routing never change when orgs arrive.
const OSS_ORG_ID = "ORG-0000-0000-0000";

// The reserved org that owns Caracal's system zone, identical for every account and edition, so the
// system zone reads as belonging to Caracal rather than to the open-source sentinel org.
const CARACAL_ORG_ID = "ORG-CRC0-SYS0-0001";

// Builds an account/org/zone-scoped Console path. Identity comes from the current profile and
// active zone, so every link carries it without each caller threading params. A sub-path like
// "/audit" is appended; the bare app root is "". Defaults to the open-source sentinel org; the
// system zone passes the Caracal org so its URL reflects Caracal ownership.
export function appLink(sub = "", zoneId?: string, orgId: string = OSS_ORG_ID): string {
  const account = getProfile().accountId;
  const zone = zoneId ?? getActiveZoneId() ?? "_";
  return `/${account}/${orgId}/${zone}/app${sub}`;
}

// Converts a flat nav path (/app or /app/audit) into the account/org/zone-scoped link, so the
// shared nav model keeps stable flat ids while every rendered link carries identity.
export function navTarget(to: string): string {
  return appLink(to === "/app" ? "" : to.slice(4));
}

// Opens the reserved system zone in a read-only viewer tab: the Caracal org and the system zone id
// under the current account, with ?systemZone=1 to latch the tab read-only. The system zone is not
// in the normal zone list, so its id comes from the operator status, not the active zone.
export function systemZoneViewPath(systemZoneId: string): string {
  return `${appLink("", systemZoneId, CARACAL_ORG_ID)}?systemZone=1`;
}
