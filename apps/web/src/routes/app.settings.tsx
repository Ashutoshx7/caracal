/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the settings route.
*/
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  SectionTitle,
  Skeleton,
  Tabs,
  useToast,
} from "@/components/ui";
import {
  changePassword,
  listSessions,
  revokeOtherSessions,
  signOut,
  updateUser,
  useSession,
} from "@/platform/auth";
import { getProfile, setProfile } from "@/platform/state/localInstall";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState("profile");

  return (
    <ModulePage
      title="Settings"
      description="Manage your profile, account, and active sessions."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Settings" }]}
    >
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "profile", label: "Profile" },
            { id: "account", label: "Account" },
            { id: "sessions", label: "Sessions" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "profile" ? <ProfileTab /> : null}
      {tab === "account" ? <AccountTab /> : null}
      {tab === "sessions" ? <SessionsTab /> : null}
    </ModulePage>
  );
}

function ProfileTab() {
  const toast = useToast();
  const session = useSession();
  const profile = getProfile();

  const [fullName, setFullName] = useState(profile.fullName || session.data?.user?.name || "");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = fullName.trim() || "Owner";
    setSaving(true);
    try {
      // The full name is the canonical account identity; persist it to the real
      // user record so it is consistent across every device and session.
      const result = await updateUser({ name });
      if (result?.error) throw new Error(result.error.message ?? "update_failed");
      setProfile({ ...getProfile(), fullName: name, displayName: displayName.trim() });
      toast({ tone: "success", title: "Profile saved" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not save profile",
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <SectionTitle>Profile</SectionTitle>
      <div className="mt-4 flex flex-col gap-4">
        <Field
          label="Full name"
          value={fullName}
          maxLength={40}
          onChange={(e) => setFullName(e.target.value.slice(0, 40))}
        />
        <Field
          label="Display name"
          hint="Optional. How you appear in the Console."
          value={displayName}
          maxLength={24}
          onChange={(e) =>
            setDisplayName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24))
          }
        />
        <Field
          label="Account ID"
          value={profile.accountId}
          readOnly
          disabled
          hint="Generated and locked. Your internal identifier."
        />
        <div>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountTab() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);

  const hasPassword = true;

  async function submitPassword() {
    if (next.length < 8) {
      toast({
        tone: "error",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }
    setChanging(true);
    try {
      const result = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (result?.error) throw new Error(result.error.message ?? "change_failed");
      setCurrent("");
      setNext("");
      toast({
        tone: "success",
        title: "Password changed",
        description: "Other sessions were signed out.",
      });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not change password",
        description:
          err instanceof Error ? err.message : "Check your current password and try again.",
      });
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card>
        <SectionTitle>Account</SectionTitle>
        <dl className="mt-4 divide-y divide-border text-sm">
          <div className="flex justify-between py-2.5">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{session.data?.user?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono text-xs text-foreground">
              {session.data?.user?.email ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <Badge tone="neutral">Owner</Badge>
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              navigate({ to: "/sign-in" });
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>

      {hasPassword ? (
        <Card>
          <SectionTitle>Change password</SectionTitle>
          <div className="mt-4 flex flex-col gap-4">
            <Field
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Field
              label="New password"
              type="password"
              hint="At least 8 characters. Other sessions will be signed out."
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <div>
              <Button onClick={submitPassword} loading={changing} disabled={!current || !next}>
                Update password
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

interface SessionRow {
  id: string;
  token?: string;
  createdAt?: string | Date;
  expiresAt?: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function SessionsTab() {
  const toast = useToast();
  const session = useSession();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentToken = (session.data?.session as { token?: string } | undefined)?.token;

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listSessions();
      if (result?.error) throw new Error(result.error.message ?? "list_failed");
      setRows((result?.data as SessionRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeOthers() {
    setRevoking(true);
    try {
      const result = await revokeOtherSessions();
      if (result?.error) throw new Error(result.error.message ?? "revoke_failed");
      toast({ tone: "success", title: "Other sessions signed out" });
      await load();
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not revoke sessions",
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <div className="flex items-center justify-between">
        <SectionTitle>Active sessions</SectionTitle>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          loading={revoking}
          disabled={!rows || rows.length <= 1}
        >
          Sign out other sessions
        </Button>
      </div>

      {rows === null ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => {
            const isCurrent = currentToken !== undefined && row.token === currentToken;
            return (
              <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {describeAgent(row.userAgent)}
                    </span>
                    {isCurrent ? <Badge tone="success">This device</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {row.ipAddress ? `${row.ipAddress} · ` : ""}
                    {row.createdAt ? `started ${new Date(row.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
                {row.expiresAt ? (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    expires {new Date(row.expiresAt).toLocaleDateString()}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Sign out other sessions"
        description="This signs out every session except this one. Other devices will need to sign in again."
        confirmLabel="Sign out others"
        tone="danger"
        onConfirm={revokeOthers}
      />
    </Card>
  );
}

function describeAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Linux/.test(ua)
        ? "Linux"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad/.test(ua)
            ? "iOS"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
