/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the settings route.
*/
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { EnterpriseUpsell } from "@/components/console/EnterpriseUpsell";
import {
  AvatarPicker,
  Badge,
  Button,
  Field,
  LockBadge,
  Modal,
  Skeleton,
  Tooltip,
  useToast,
} from "@/components/ui";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";
import { consoleApi, ConsoleApiError } from "@/platform/api/client";
import { useOperatorAiStatus, useOperatorAiCheck, useZones } from "@/platform/api/hooks";
import {
  AuthApiError,
  changePassword,
  deleteAccount,
  listSessions,
  revokeOtherSessions,
  signOut,
  updateUser,
  useSession,
} from "@/platform/auth";
import {
  clearLocalIdentity,
  getProfile,
  HANDLE_MAX,
  NAME_MAX,
  resolveDisplayName,
  sanitizeHandle,
  setProfile,
  useProfile,
} from "@/platform/state/localInstall";
import { setTheme, useTheme } from "@/platform/theme";

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  featureSlug?: string;
}

interface SettingsNavGroup {
  id: string;
  label: string;
  items: SettingsSection[];
}

const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "profile", label: "Profile", description: "Identity, avatar, and operator naming." },
      { id: "access", label: "Access", description: "Password and sign-in security." },
      { id: "sessions", label: "Sessions", description: "Authenticated devices and expiry." },
      { id: "preferences", label: "Preferences", description: "Theme defaults." },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "ai-operator",
        label: "AI Operator",
        description: "Model providers and governed routing for the Caracal Operator.",
      },
      {
        id: "sso",
        label: "SSO & Directory Sync",
        description: LOCKED_FEATURES.sso.summary,
        featureSlug: "sso",
      },
      {
        id: "members",
        label: "Members & Roles",
        description: LOCKED_FEATURES["teams-roles"].summary,
        featureSlug: "teams-roles",
      },
      {
        id: "organization",
        label: "Organization",
        description: LOCKED_FEATURES.organizations.summary,
        featureSlug: "organizations",
      },
      {
        id: "integrations",
        label: "Integrations",
        description: LOCKED_FEATURES.connectors.summary,
        featureSlug: "connectors",
      },
    ],
  },
  {
    id: "danger",
    label: "Danger zone",
    items: [
      {
        id: "lifecycle",
        label: "Account deletion",
        description: "Delete the authenticated account.",
      },
    ],
  },
];

const ALL_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.items);

type SectionId = string;

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [section, setSection] = useState<SectionId>("profile");
  const current = ALL_SECTIONS.find((item) => item.id === section) ?? ALL_SECTIONS[0];
  const feature = current.featureSlug ? LOCKED_FEATURES[current.featureSlug] : undefined;

  return (
    <ModulePage
      title="Settings"
      description="Account and administration controls."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Settings" }]}
    >
      <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="border border-border bg-card">
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.id} className="border-b border-border last:border-b-0">
                <div className="px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </div>
                <nav className="grid">
                  {group.items.map((item) => {
                    const active = item.id === section;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        className={[
                          "flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        {item.featureSlug ? (
                          <span className={active ? "opacity-80" : ""}>
                            <LockBadge />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 border-y border-border">
          <div className="border-b border-border py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {current.label}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {current.label}
              </h2>
              {feature ? <LockBadge /> : <HelpTip label={current.description} />}
            </div>
          </div>

          <div>
            {section === "profile" ? <ProfileSection /> : null}
            {section === "access" ? <AccessSection /> : null}
            {section === "sessions" ? <SessionsSection /> : null}
            {section === "preferences" ? <PreferencesSection /> : null}
            {section === "ai-operator" ? <AiOperatorSection /> : null}
            {section === "lifecycle" ? <LifecycleSection /> : null}
            {feature ? (
              <div className="py-6">
                <EnterpriseUpsell feature={feature} heading={false} />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ModulePage>
  );
}

function SettingsGroup({
  title,
  description,
  action,
  children,
  danger = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={[
        "grid gap-5 border-t py-8 first:border-t-0 first:pt-8 last:pb-8 2xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]",
        danger ? "border-destructive/30" : "border-border",
      ].join(" ")}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3
            className={[
              "text-sm font-semibold",
              danger ? "text-destructive" : "text-foreground",
            ].join(" ")}
          >
            {title}
          </h3>
          {description ? <HelpTip label={description} /> : null}
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function HelpTip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span
        tabIndex={0}
        aria-label="More information"
        className="inline-grid h-5 w-5 place-items-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        ?
      </span>
    </Tooltip>
  );
}

function ProfileSection() {
  const toast = useToast();
  const session = useSession();
  const profile = useProfile();

  const [fullName, setFullName] = useState(profile.fullName || session.data?.user?.name || "");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName || session.data?.user?.name || "");
    setDisplayName(profile.displayName);
    setAvatar(profile.avatar);
  }, [profile, session.data?.user?.name]);

  async function save() {
    const name = fullName.trim() || "Owner";
    const handle = resolveDisplayName(fullName, displayName);
    setSaving(true);
    try {
      const result = await updateUser({ name, image: avatar || undefined });
      if (result?.error) throw new Error(result.error.message ?? "update_failed");
      setProfile({ ...getProfile(), fullName: name, displayName: handle, avatar });
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
    <div>
      <SettingsGroup
        title="Profile image"
        description="Use a compact operator icon that appears in the dashboard navbar and profile menu."
      >
        <AvatarPicker value={avatar} fallbackName={displayName || fullName} onChange={setAvatar} />
      </SettingsGroup>

      <SettingsGroup
        title="Operator identity"
        description="The display name is the short name shown in Caracal chrome. The full name is stored on your authenticated user record."
        action={
          <Button onClick={save} loading={saving}>
            Save profile
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Full name"
            value={fullName}
            maxLength={NAME_MAX}
            onChange={(e) => setFullName(e.target.value.slice(0, NAME_MAX))}
          />
          <Field
            label="Display name"
            hint="Optional. Defaults to your first name. Shown in the profile menu."
            value={displayName}
            maxLength={HANDLE_MAX}
            onChange={(e) => setDisplayName(sanitizeHandle(e.target.value))}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Account identifiers" description="Identifiers for this owner account.">
        <InfoGrid>
          <InfoItem label="Account ID" value={profile.accountId} mono />
          <InfoItem label="Email" value={session.data?.user?.email ?? "-"} mono />
          <InfoItem label="Role" value="Owner" />
        </InfoGrid>
      </SettingsGroup>
    </div>
  );
}

function AccessSection() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

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

  async function confirmSignOut() {
    await signOut();
    navigate({ to: "/sign-in" });
  }

  return (
    <div>
      <SettingsGroup
        title="Signed-in account"
        description="The authenticated owner for this web session."
      >
        <InfoGrid>
          <InfoItem label="Name" value={session.data?.user?.name ?? "-"} />
          <InfoItem label="Email" value={session.data?.user?.email ?? "-"} mono />
          <InfoItem label="Role" value="Owner" />
        </InfoGrid>
      </SettingsGroup>

      <SettingsGroup
        title="Password"
        description="Changing your password revokes every other active session immediately."
        action={
          <Button onClick={submitPassword} loading={changing} disabled={!current || !next}>
            Update password
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Current password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            hint="Minimum 8 characters."
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Sign out"
        description="End this browser session without changing account or control-plane data."
        action={
          <Button variant="secondary" onClick={() => setSignOutOpen(true)}>
            Sign out
          </Button>
        }
      >
        <InfoGrid>
          <InfoItem label="Effect" value="Current session only" />
          <InfoItem label="Data" value="Unchanged" />
        </InfoGrid>
      </SettingsGroup>

      <ConfirmModal
        open={signOutOpen}
        title="Sign out"
        description="Are you sure you want to sign out of Caracal? You will need to sign in again to continue."
        confirmLabel="Sign out"
        onClose={() => setSignOutOpen(false)}
        onConfirm={confirmSignOut}
      />
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

function SessionsSection() {
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
    <div>
      <SettingsGroup
        title="Active sessions"
        description="Review authenticated devices and revoke every session except this browser."
        action={
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            loading={revoking}
            disabled={!rows || rows.length <= 1}
          >
            Sign out other sessions
          </Button>
        }
      >
        <div className="min-h-[320px] border border-border bg-card">
          {rows === null ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <p className="m-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const isCurrent = currentToken !== undefined && row.token === currentToken;
                return (
                  <li
                    key={row.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
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
                      <span className="text-xs text-muted-foreground md:text-right">
                        expires {new Date(row.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SettingsGroup>

      <ConfirmModal
        open={confirmOpen}
        title="Sign out other sessions"
        description="This signs out every session except this one. Other devices will need to sign in again."
        confirmLabel="Sign out others"
        onClose={() => setConfirmOpen(false)}
        onConfirm={revokeOthers}
        danger
      />
    </div>
  );
}

function PreferencesSection() {
  const theme = useTheme();

  return (
    <div>
      <SettingsGroup
        title="Appearance"
        description="Theme applies immediately across the web console."
      >
        <div className="inline-flex border border-border bg-card p-1">
          {(["dark", "light"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
              className={[
                "h-8 px-3 text-xs font-medium capitalize transition-colors",
                theme === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}

/* ------------------------------ AI Operator ------------------------------ */

type PresetFamily = "OpenAI" | "Anthropic" | "Google" | "Custom";
type EndpointKind = "direct" | "aggregator" | "custom";

interface ModelPreset {
  id: string;
  label: string;
  family: PresetFamily;
  model: string;
  providerId: string;
  endpoint: EndpointKind;
  baseUrlHint: string;
  note: string;
}

const AGGREGATOR_NOTE =
  "Not an OpenAI-wire-format API. Front it with an OpenAI-compatible aggregator (a self-hosted LiteLLM proxy or OpenRouter) and point the endpoint there.";
const DIRECT_NOTE = "OpenAI-compatible, so OpenAI or Azure OpenAI connects directly.";
const AGGREGATOR_BASE_URL = "https://your-litellm-or-openrouter/v1";

const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    family: "OpenAI",
    model: "gpt-5.5",
    providerId: "openai",
    endpoint: "direct",
    baseUrlHint: "https://api.openai.com/v1",
    note: DIRECT_NOTE,
  },
  {
    id: "gpt-5.4",
    label: "GPT 5.4",
    family: "OpenAI",
    model: "gpt-5.4",
    providerId: "openai",
    endpoint: "direct",
    baseUrlHint: "https://api.openai.com/v1",
    note: DIRECT_NOTE,
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT 5.4 mini",
    family: "OpenAI",
    model: "gpt-5.4-mini",
    providerId: "openai",
    endpoint: "direct",
    baseUrlHint: "https://api.openai.com/v1",
    note: DIRECT_NOTE,
  },
  {
    id: "claude-opus-4.8",
    label: "Claude Opus 4.8",
    family: "Anthropic",
    model: "claude-opus-4.8",
    providerId: "anthropic",
    endpoint: "aggregator",
    baseUrlHint: AGGREGATOR_BASE_URL,
    note: AGGREGATOR_NOTE,
  },
  {
    id: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    family: "Anthropic",
    model: "claude-sonnet-4.6",
    providerId: "anthropic",
    endpoint: "aggregator",
    baseUrlHint: AGGREGATOR_BASE_URL,
    note: AGGREGATOR_NOTE,
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    family: "Google",
    model: "gemini-3.5-flash",
    providerId: "gemini",
    endpoint: "aggregator",
    baseUrlHint: AGGREGATOR_BASE_URL,
    note: AGGREGATOR_NOTE,
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    family: "Google",
    model: "gemini-3.1-pro",
    providerId: "gemini",
    endpoint: "aggregator",
    baseUrlHint: AGGREGATOR_BASE_URL,
    note: AGGREGATOR_NOTE,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    family: "Custom",
    model: "",
    providerId: "custom",
    endpoint: "custom",
    baseUrlHint: "https://your-endpoint/v1",
    note: "Any model reachable over an OpenAI-compatible /chat/completions endpoint.",
  },
];

// The Operator addresses providers by a slug used to build its env keys, so the slug is
// constrained to the same shape the API enforces: letters, digits, and underscores.
function sanitizeProviderId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

// Assembles the exact governed provider configuration for the chosen model. The key is woven
// in only on the client when present, so it never leaves the browser; the placeholder keeps the
// block copy-ready before a key is entered. Caracal seals the key at boot and routes the call
// through the gateway, so the value here is only ever placed into the deployment's own config.
function buildEnvConfig(input: {
  providerId: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow: string;
}): string {
  const id = sanitizeProviderId(input.providerId) || "openai";
  const upper = id.toUpperCase();
  const lines = [
    `API_OPERATOR_AI_PROVIDERS=${id}`,
    `API_OPERATOR_AI_${upper}_BASE_URL=${input.baseUrl || "https://your-endpoint/v1"}`,
    `API_OPERATOR_AI_${upper}_MODEL=${input.model || "your-model-id"}`,
    `API_OPERATOR_AI_${upper}_API_KEY=${input.apiKey || "your-api-key"}`,
  ];
  const ctx = input.contextWindow.trim();
  if (ctx) lines.push(`API_OPERATOR_AI_${upper}_CONTEXT_WINDOW=${ctx}`);
  return lines.join("\n");
}

function CodeBlock({ text }: { text: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "Copied" });
    } catch {
      toast({ tone: "error", title: "Copy failed" });
    }
  }
  return (
    <div className="relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-md border border-border bg-muted/40 p-3 pr-20 font-mono text-xs leading-relaxed text-foreground">
        {text}
      </pre>
      <Button
        variant="secondary"
        size="sm"
        className="absolute right-2 top-2"
        onClick={copy}
        type="button"
      >
        Copy
      </Button>
    </div>
  );
}

function checkErrorMessage(err: unknown): string {
  if (err instanceof ConsoleApiError) {
    if (err.code === "ai_unavailable") return "No AI provider is configured for the Operator.";
    if (err.code === "ai_unreachable")
      return "The configured provider could not be reached. Check the endpoint and key.";
  }
  return "The connectivity check failed. Try again.";
}

function AiOperatorSection() {
  const status = useOperatorAiStatus(true);
  const check = useOperatorAiCheck();

  const [presetId, setPresetId] = useState<string>(MODEL_PRESETS[0].id);
  const preset = MODEL_PRESETS.find((item) => item.id === presetId) ?? MODEL_PRESETS[0];

  const [providerId, setProviderId] = useState(preset.providerId);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState(preset.model);
  const [apiKey, setApiKey] = useState("");
  const [contextWindow, setContextWindow] = useState("");

  // Choosing a preset reseeds the editable fields with its defaults so the model id and slug
  // are correct out of the box, while leaving the endpoint and key for the operator to supply.
  function choosePreset(id: string) {
    const next = MODEL_PRESETS.find((item) => item.id === id) ?? MODEL_PRESETS[0];
    setPresetId(id);
    setProviderId(next.providerId);
    setModel(next.model);
  }

  const env = buildEnvConfig({ providerId, baseUrl, model, apiKey, contextWindow });
  const providers = status.data?.providers ?? [];
  const connected = status.data?.enabled ?? false;

  return (
    <div>
      <SettingsGroup
        title="Status"
        description="The model providers the Operator uses, in failover order, and a live connectivity check."
      >
        <div className="grid gap-4">
          {status.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <Badge tone={connected ? "success" : "warning"}>
                {connected ? "Connected" : "No provider configured"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {connected
                  ? `${providers.length} provider${providers.length === 1 ? "" : "s"} in failover order`
                  : "Configure a provider below, then restart the API to apply it."}
              </span>
            </div>
          )}

          {providers.length > 0 ? (
            <div className="divide-y divide-border border border-border bg-card">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {provider.id}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {provider.model}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.contextWindow > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {provider.contextWindow.toLocaleString()} ctx
                      </span>
                    ) : null}
                    <Badge tone={provider.available ? "success" : "muted"}>
                      {provider.available ? "Ready" : "Unconfigured"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              loading={check.isPending}
              disabled={!connected}
              onClick={() => check.mutate()}
            >
              Test connectivity
            </Button>
            {check.isSuccess ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {check.data.provider} · {check.data.model} · {check.data.latency_ms} ms
              </span>
            ) : null}
            {check.isError ? (
              <span className="text-xs text-destructive">{checkErrorMessage(check.error)}</span>
            ) : null}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Add a model"
        description="Pick a model, supply its endpoint and key, and apply the generated configuration."
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MODEL_PRESETS.map((item) => {
              const active = item.id === presetId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choosePreset(item.id)}
                  className={[
                    "flex flex-col gap-0.5 border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-surface",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span
                    className={[
                      "text-[11px]",
                      active ? "text-background/70" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {item.family}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={[
              "flex items-start gap-2 border px-3 py-2.5 text-xs",
              preset.endpoint === "aggregator"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border bg-muted/40 text-muted-foreground",
            ].join(" ")}
          >
            <span>{preset.note}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Provider id"
              info="A short slug used to build the Operator's configuration keys."
              value={providerId}
              onChange={(event) => setProviderId(sanitizeProviderId(event.target.value))}
              placeholder="openai"
            />
            <Field
              label="Model id"
              info="The exact model string the endpoint expects."
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="your-model-id"
            />
            <Field
              label="Endpoint base URL"
              info="The OpenAI-compatible base URL the request is sent to."
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={preset.baseUrlHint}
              className="font-mono"
            />
            <Field
              label="API key"
              info="Stays in your browser — it is only woven into the configuration you copy, then sealed by Caracal at boot."
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="your-api-key"
            />
            <Field
              label="Context window"
              info="Optional. The model's token window, used for the usage gauge."
              value={contextWindow}
              onChange={(event) => setContextWindow(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="128000"
              inputMode="numeric"
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Configuration</span>
            <p className="text-xs text-muted-foreground">
              Apply these to the API environment (the deployment's env file or secret store), then
              restart the API. Caracal seals the key into the caracal.sys system zone and routes the
              Operator's calls through its gateway, so the Operator never holds the key.
            </p>
            <CodeBlock text={env} />
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
}

function LifecycleSection() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();
  const zones = useZones();
  const email = session.data?.user?.email ?? "";

  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const zoneCount = zones.data?.length ?? 0;
  const blocked = zones.isLoading;
  const confirmReady = confirm.trim() === email;

  async function confirmDelete() {
    setDeleting(true);
    try {
      // Profile deletion must be the guaranteed outcome: clean up owned zones on a
      // best-effort basis so a single zone failure (e.g. a 404 for an already
      // archived zone) can never leave the operator's profile behind.
      let zoneFailures = 0;
      try {
        const latest = await zones.refetch();
        for (const zone of latest.data ?? []) {
          try {
            await consoleApi.zones.delete(zone.id);
          } catch {
            zoneFailures += 1;
          }
        }
      } catch {
        zoneFailures += 1;
      }

      await deleteAccount(confirm);
      clearLocalIdentity();
      if (zoneFailures > 0) {
        toast({
          tone: "info",
          title: "Profile deleted",
          description: `${zoneFailures} zone${zoneFailures === 1 ? "" : "s"} could not be removed and may need manual cleanup.`,
        });
      }
      navigate({ to: "/sign-in" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not delete profile",
        description:
          err instanceof AuthApiError
            ? err.code
            : err instanceof Error
              ? err.message
              : "Unexpected error.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <SettingsGroup
        title="Deletion scope"
        description="Profile deletion also removes owned zones."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Metric
            label="Zones"
            value={zones.isLoading ? "..." : zones.isError ? "!" : String(zoneCount)}
          />
          <Metric label="Owner email" value={email || "-"} mono />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Delete profile"
        description="Permanently removes your profile, sessions, sign-in accounts, and zones."
        danger
      >
        <div className="border border-destructive/30 bg-destructive/5 p-4">
          {zones.isError ? (
            <p className="mt-3 text-sm text-destructive">Zone state unavailable.</p>
          ) : zoneCount > 0 ? (
            <p className="mt-3 text-sm text-destructive">
              Includes {zoneCount} zone{zoneCount === 1 ? "" : "s"}.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/zones"
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Manage zones
            </Link>
            <Button variant="danger" disabled={blocked} onClick={() => setOpen(true)}>
              Delete profile
            </Button>
          </div>
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Delete profile"
          description="This deletes your profile, sessions, sign-in accounts, and all owned zones. This action cannot be undone."
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
                disabled={!confirmReady}
              >
                Delete profile and zones
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Type <span className="font-mono text-foreground">{email}</span> to confirm.
            </p>
            <InfoGrid>
              <InfoItem label="Zones" value={String(zoneCount)} />
              <InfoItem label="Profile" value="Delete" />
            </InfoGrid>
            <Field
              label="Confirm email"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      </SettingsGroup>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  danger = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 border border-border bg-card p-4 md:grid-cols-3">{children}</dl>;
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={["mt-1 truncate text-sm text-foreground", mono ? "font-mono text-xs" : ""].join(
          " ",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={[
          "mt-2 text-lg font-semibold text-foreground",
          mono ? "font-mono text-sm" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
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
