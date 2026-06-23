/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides route guards that bridge Better Auth sessions with onboarding state.
*/
import { redirect } from "@tanstack/react-router";

import { getSession } from "@/platform/auth";
import { isOnboarded } from "@/platform/state/localInstall";

export async function hasSession(): Promise<boolean> {
  try {
    const { data } = await getSession();
    return Boolean(data?.user);
  } catch {
    return false;
  }
}

export async function requireAuthenticatedOperator(): Promise<void> {
  if (!(await hasSession())) throw redirect({ to: "/sign-in" });
}

export async function requireOnboardedInstallation(): Promise<void> {
  await requireAuthenticatedOperator();
  if (!isOnboarded()) throw redirect({ to: "/onboarding" });
}

export async function requirePendingOnboarding(): Promise<void> {
  await requireAuthenticatedOperator();
  if (isOnboarded()) throw redirect({ to: "/app" });
}
