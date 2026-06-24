/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides route guards that bridge Better Auth sessions with onboarding state.
*/
import { redirect } from "@tanstack/react-router";

import { ConsoleApiError, consoleApi } from "@/platform/api/client";
import { getSession } from "@/platform/auth";
import {
  completeOnboarding,
  getActiveZoneId,
  getProfile,
  isOnboarded,
  reconcileLocalIdentity,
  setActiveZoneId,
} from "@/platform/state/localInstall";

interface SessionUser {
  id: string;
  name?: string | null;
}

async function currentUser(): Promise<SessionUser | null> {
  try {
    const { data } = await getSession();
    const user = data?.user ?? null;
    const id = user?.id ?? null;
    // The backend account is authoritative: align the browser-local identity with it
    // (clearing it when the account is gone) before gating the route.
    reconcileLocalIdentity(id);
    return id ? { id, name: user?.name ?? null } : null;
  } catch {
    return null;
  }
}

export async function hasSession(): Promise<boolean> {
  return (await currentUser()) !== null;
}

async function requireOperator(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw redirect({ to: "/sign-in" });
  return user;
}

export async function requireAuthenticatedOperator(): Promise<void> {
  await requireOperator();
}

// The backend is the source of truth for whether an operator already has an environment:
// a localStorage onboarding flag can be missing on a new browser or after an identity
// reset even though zones already exist. Treat any existing backend zone as proof of
// onboarding, hydrating local state so the operator skips the wizard rather than being
// pushed to create a duplicate zone. Returns null when the control plane is unavailable.
async function hasProvisionedEnvironment(user: SessionUser): Promise<boolean | null> {
  try {
    const zones = await consoleApi.zones.list();
    if (zones.length === 0) return false;
    if (!isOnboarded()) {
      const profile = getProfile();
      completeOnboarding({ ...profile, fullName: profile.fullName || user.name || "" });
    }
    if (!getActiveZoneId()) setActiveZoneId(zones[0].id);
    return true;
  } catch (err) {
    if (err instanceof ConsoleApiError) return null;
    return null;
  }
}

export async function requireOnboardedInstallation(): Promise<void> {
  const user = await requireOperator();
  if (isOnboarded()) return;
  if (await hasProvisionedEnvironment(user)) return;
  throw redirect({ to: "/onboarding" });
}

export async function requirePendingOnboarding(): Promise<void> {
  const user = await requireOperator();
  if (isOnboarded()) throw redirect({ to: "/app" });
  if (await hasProvisionedEnvironment(user)) throw redirect({ to: "/app" });
}
