/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file classifies zones, identifying Caracal's reserved internal system zone from its namespace.
*/
import type { Zone } from "@/platform/api/types";

// The reserved namespace Caracal uses for its own internal system zone, encoded per field exactly
// as the control plane reserves it (slug and name carry different separators). A zone in this
// namespace is provisioned and governed by Caracal itself and is shown read-only for transparency.
const SYSTEM_ZONE_SLUG_PREFIX = "caracal-sys-";
const SYSTEM_ZONE_NAME_PREFIX = "caracal.sys/";

export function isSystemZone(zone: Pick<Zone, "slug" | "name"> | null | undefined): boolean {
  if (!zone) return false;
  const slug = (zone.slug ?? "").trim().toLowerCase();
  const name = (zone.name ?? "").trim().toLowerCase();
  return slug.startsWith(SYSTEM_ZONE_SLUG_PREFIX) || name.startsWith(SYSTEM_ZONE_NAME_PREFIX);
}
