/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Console dashboard overview route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Button, Card, LockBadge, SectionTitle, Skeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";
import {
  useActiveZone,
  useApplications,
  useConsoleStatus,
  usePolicySets,
  useProviders,
  useResources,
} from "@/platform/api/hooks";
import type { ConsoleStatus, Zone } from "@/platform/api/types";
import { workspaceLabel } from "@/platform/state/localInstall";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

type Connection = "connecting" | "not_configured" | "unreachable" | "connected";

function connectionOf(status: ConsoleStatus | undefined, isError: boolean): Connection {
  if (isError || !status) return "unreachable";
  if (!status.configured) return "not_configured";
  if (!status.reachable) return "unreachable";
  return "connected";
}

interface AttentionItem {
  id: string;
  level: "warning" | "info";
  title: string;
  detail: string;
  to: string;
}

function DashboardPage() {
  const workspace = workspaceLabel();
  const statusQuery = useConsoleStatus();
  const { zones, activeZone } = useActiveZone();

  const connection = connectionOf(statusQuery.data, statusQuery.isError);
  const connected = connection === "connected";
  const zoneId = connected ? (activeZone?.id ?? null) : null;

  const apps = useApplications(zoneId);
  const resources = useResources(zoneId);
  const providers = useProviders(zoneId);
  const policySets = usePolicySets(zoneId);

  const statusLoading = statusQuery.isLoading;

  const attention: AttentionItem[] = [];
  if (connected && activeZone) {
    if ((policySets.data?.length ?? 0) === 0 && !policySets.isLoading) {
      attention.push({
        id: "no-policy-set",
        level: "warning",
        title: "No active policy set",
        detail: `Zone ${activeZone.name} has no policy set. Requests fall back to deny.`,
        to: "/app/policy-sets",
      });
    }
    if ((providers.data?.length ?? 0) === 0 && !providers.isLoading) {
      attention.push({
        id: "no-provider",
        level: "info",
        title: "No identity provider configured",
        detail: `Add a provider to ${activeZone.name} so applications can obtain mandates.`,
        to: "/app/providers",
      });
    }
  }

  const activeName = activeZone?.name ?? null;

  return (
    <ModulePage
      title="Dashboard"
      description={
        activeName ? `Operating ${workspace} · active zone ${activeName}` : `Operating ${workspace}`
      }
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Dashboard" }]}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => statusQuery.refetch()}
          loading={statusQuery.isFetching}
        >
          Refresh
        </Button>
      }
    >
      <StatusHero
        connection={connection}
        loading={statusLoading}
        attentionCount={attention.length}
        zones={zones.length}
        apps={count(apps.data)}
        resources={count(resources.data)}
        providers={count(providers.data)}
        policySets={count(policySets.data)}
        countsLoading={connected && (apps.isLoading || resources.isLoading)}
      />

      <Attention connection={connection} loading={statusLoading} items={attention} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ZonesPanel zones={zones} activeId={activeZone?.id ?? null} loading={statusLoading} />
        </div>
        <div className="flex flex-col gap-4">
          <SetupPanel
            connected={connected}
            hasZone={zones.length > 0}
            hasProvider={count(providers.data) > 0}
            hasPolicySet={count(policySets.data) > 0}
            loading={statusLoading}
          />
          <ControlPlanePanel
            status={statusQuery.data}
            connection={connection}
            loading={statusLoading}
          />
        </div>
      </div>

      <EnterprisePanel />
    </ModulePage>
  );
}

function count(rows: unknown[] | undefined): number {
  return rows?.length ?? 0;
}

/* ----------------------------------- shared ----------------------------------- */

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SectionTitle>{title}</SectionTitle>
      {action}
    </div>
  );
}

function ViewAll({ to, label = "View all" }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function Metric({
  label,
  value,
  to,
  loading,
}: {
  label: string;
  value: ReactNode;
  to: string;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-md border border-border bg-background px-3 py-3 transition-colors hover:bg-accent"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-1.5 h-6 w-10" />
      ) : (
        <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</div>
      )}
    </Link>
  );
}

/* ----------------------------------- sections ----------------------------------- */

const HERO: Record<Connection, { tone: string; headline: string; detail: string }> = {
  connecting: {
    tone: "bg-muted",
    headline: "Connecting…",
    detail: "Checking the control plane connection.",
  },
  connected: {
    tone: "bg-emerald-500/15",
    headline: "Control plane connected",
    detail: "Secure authority and control plane for your agents, policies, and zones.",
  },
  not_configured: {
    tone: "bg-amber-500/15",
    headline: "Control plane not connected",
    detail: "Start the local stack with `caracal up` to provision admin credentials.",
  },
  unreachable: {
    tone: "bg-destructive/15",
    headline: "Control plane unreachable",
    detail: "The control plane is not responding. Confirm the stack is running.",
  },
};

function StatusHero({
  connection,
  loading,
  attentionCount,
  zones,
  apps,
  resources,
  providers,
  policySets,
  countsLoading,
}: {
  connection: Connection;
  loading: boolean;
  attentionCount: number;
  zones: number;
  apps: number;
  resources: number;
  providers: number;
  policySets: number;
  countsLoading: boolean;
}) {
  const hero = HERO[loading ? "connecting" : connection];
  const headline =
    connection === "connected" && attentionCount > 0
      ? "Operational — items need attention"
      : hero.headline;

  return (
    <Card className="bg-card">
      <div className="flex items-center gap-3">
        <span className={cx("grid h-10 w-10 place-items-center rounded-full", hero.tone)}>
          <span className="block h-2 w-2 rounded-full bg-current" />
        </span>
        <div>
          <div className="text-base font-semibold tracking-tight text-foreground">{headline}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{hero.detail}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Zones" value={zones} to="/app/zones" loading={loading} />
        <Metric label="Applications" value={apps} to="/app/applications" loading={countsLoading} />
        <Metric label="Resources" value={resources} to="/app/resources" loading={countsLoading} />
        <Metric label="Providers" value={providers} to="/app/providers" loading={countsLoading} />
        <Metric
          label="Policy sets"
          value={policySets}
          to="/app/policy-sets"
          loading={countsLoading}
        />
      </div>
    </Card>
  );
}

function Attention({
  connection,
  loading,
  items,
}: {
  connection: Connection;
  loading: boolean;
  items: AttentionItem[];
}) {
  if (loading) {
    return (
      <Card className="mt-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
      </Card>
    );
  }

  if (connection !== "connected") {
    return (
      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <span className="block h-2 w-2 rounded-full bg-current" />
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {connection === "not_configured"
                ? "Control plane not connected"
                : "Control plane unreachable"}
            </div>
            <div className="text-xs text-muted-foreground">
              Connect the control plane to view live operational status.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">Nothing needs attention</div>
            <div className="text-xs text-muted-foreground">
              Your active zone is configured and healthy.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <SectionHeader title={`Needs attention · ${items.length}`} />
      <ul className="mt-3 divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
            >
              <span className="mt-0.5">
                <Badge tone={item.level === "warning" ? "warning" : "neutral"}>{item.level}</Badge>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ZonesPanel({
  zones,
  activeId,
  loading,
}: {
  zones: Zone[];
  activeId: string | null;
  loading: boolean;
}) {
  return (
    <Card>
      <SectionHeader title="Zones" action={<ViewAll to="/app/zones" />} />
      {loading ? (
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : zones.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {zones.slice(0, 5).map((zone) => (
            <li key={zone.id}>
              <Link
                to="/app/zones"
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
              >
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  {zone.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {zone.name}
                    </span>
                    {zone.id === activeId ? <Badge tone="success">Active</Badge> : null}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {zone.slug}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center">
          <div className="text-sm font-medium text-foreground">No zones yet</div>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Zones are Caracal's primary trust boundary. Create one to start managing authority.
          </p>
          <div className="mt-4">
            <Link to="/app/zones">
              <Button size="sm">Create zone</Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

function SetupPanel({
  connected,
  hasZone,
  hasProvider,
  hasPolicySet,
  loading,
}: {
  connected: boolean;
  hasZone: boolean;
  hasProvider: boolean;
  hasPolicySet: boolean;
  loading: boolean;
}) {
  const setup = [
    { id: "zone", label: "Create your first zone", done: hasZone, to: "/app/zones" },
    {
      id: "provider",
      label: "Connect an identity provider",
      done: hasProvider,
      to: "/app/providers",
    },
    { id: "policy", label: "Activate a policy set", done: hasPolicySet, to: "/app/policy-sets" },
  ];
  const done = connected ? setup.filter((s) => s.done).length : 0;
  const pct = setup.length ? Math.round((done / setup.length) * 100) : 0;

  return (
    <Card>
      <SectionHeader title="Continue setup" />
      {loading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {done}/{setup.length}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {setup.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <span
                    className={cx(
                      "grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border",
                      item.done
                        ? "border-transparent bg-foreground text-background"
                        : "border-border",
                    )}
                  >
                    {item.done ? (
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : null}
                  </span>
                  <span
                    className={cx(
                      "text-sm",
                      item.done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ControlPlanePanel({
  status,
  connection,
  loading,
}: {
  status: ConsoleStatus | undefined;
  connection: Connection;
  loading: boolean;
}) {
  const tone =
    connection === "connected"
      ? "bg-emerald-500"
      : connection === "not_configured"
        ? "bg-amber-500"
        : "bg-destructive";
  const label =
    connection === "connected"
      ? "Connected"
      : connection === "not_configured"
        ? "Not configured"
        : "Unreachable";

  return (
    <Card>
      <SectionHeader
        title="Control plane"
        action={<ViewAll to="/app/diagnostics" label="Diagnostics" />}
      />
      {loading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground">Status</span>
            <span className="flex items-center gap-2">
              <span className={cx("inline-block h-2 w-2 rounded-full", tone)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">Endpoint</span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {status?.apiUrl ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">Edition</span>
            <Badge tone="neutral">Community</Badge>
          </div>
        </div>
      )}
    </Card>
  );
}

const ENTERPRISE_PREVIEW = ["organizations", "sso", "compliance", "analytics"] as const;

function EnterprisePanel() {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <SectionTitle>Enterprise capabilities</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Available in Caracal Enterprise. Your open-source environment is fully functional
            without them.
          </p>
        </div>
        <a
          href="https://caracal.run/enterprise"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Compare editions
        </a>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENTERPRISE_PREVIEW.map((slug) => {
          const feature = LOCKED_FEATURES[slug];
          return (
            <Link
              key={slug}
              to="/app/enterprise/$feature"
              params={{ feature: slug }}
              aria-label={`${feature.title} — available in Caracal Enterprise`}
              className="flex h-full flex-col rounded-lg border border-border bg-card/60 p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{feature.title}</span>
                <LockBadge />
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{feature.summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
