/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Console dashboard overview route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SectionLabel } from "@/components/SiteShell";
import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Button, Skeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
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

interface AttentionItem {
  id: string;
  tone: "warning" | "info";
  title: string;
  detail: string;
  to: string;
}

function connectionOf(
  status: ConsoleStatus | undefined,
  isLoading: boolean,
  isError: boolean,
): Connection {
  if (isLoading) return "connecting";
  if (isError || !status) return "unreachable";
  if (!status.configured) return "not_configured";
  if (!status.reachable) return "unreachable";
  return "connected";
}

function DashboardPage() {
  const workspace = workspaceLabel();
  const statusQuery = useConsoleStatus();
  const { zones, activeZone } = useActiveZone();

  const connection = connectionOf(statusQuery.data, statusQuery.isLoading, statusQuery.isError);
  const connected = connection === "connected";
  const zoneId = connected ? (activeZone?.id ?? null) : null;

  const apps = useApplications(zoneId);
  const resources = useResources(zoneId);
  const providers = useProviders(zoneId);
  const policySets = usePolicySets(zoneId);

  const attention = attentionItems({
    connected,
    activeZone,
    providersLoading: providers.isLoading,
    policySetsLoading: policySets.isLoading,
    providerCount: count(providers.data),
    policySetCount: count(policySets.data),
  });

  const countsLoading =
    connected &&
    (apps.isLoading || resources.isLoading || providers.isLoading || policySets.isLoading);

  return (
    <ModulePage
      title="Dashboard"
      description={
        activeZone ? `${workspace} · ${activeZone.name}` : `${workspace} · no active zone`
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
      <div className="space-y-8">
        <ControlPlaneSection
          connection={connection}
          status={statusQuery.data}
          attentionCount={attention.length}
        />

        <MetricsSection
          loading={connection === "connecting"}
          countsLoading={countsLoading}
          zones={zones.length}
          applications={count(apps.data)}
          resources={count(resources.data)}
          providers={count(providers.data)}
          policySets={count(policySets.data)}
        />

        <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:bg-background">
          <ZonesSection
            zones={zones}
            activeId={activeZone?.id ?? null}
            loading={statusQuery.isLoading}
          />
          <div className="grid gap-px bg-border [&>*]:bg-background">
            <SetupSection
              connected={connected}
              hasZone={zones.length > 0}
              hasProvider={count(providers.data) > 0}
              hasPolicySet={count(policySets.data) > 0}
              loading={statusQuery.isLoading}
            />
            <AttentionSection
              connection={connection}
              loading={statusQuery.isLoading}
              items={attention}
            />
            <DiagnosticsSection status={statusQuery.data} connection={connection} />
          </div>
        </div>
      </div>
    </ModulePage>
  );
}

function count(rows: unknown[] | undefined): number {
  return rows?.length ?? 0;
}

function attentionItems({
  connected,
  activeZone,
  providersLoading,
  policySetsLoading,
  providerCount,
  policySetCount,
}: {
  connected: boolean;
  activeZone: Zone | null;
  providersLoading: boolean;
  policySetsLoading: boolean;
  providerCount: number;
  policySetCount: number;
}): AttentionItem[] {
  if (!connected || !activeZone) return [];
  const items: AttentionItem[] = [];
  if (policySetCount === 0 && !policySetsLoading) {
    items.push({
      id: "policy-set",
      tone: "warning",
      title: "No policy set",
      detail: "Requests fall back to deny.",
      to: "/app/policy-sets",
    });
  }
  if (providerCount === 0 && !providersLoading) {
    items.push({
      id: "provider",
      tone: "info",
      title: "No provider",
      detail: "Add a provider before issuing mandates.",
      to: "/app/providers",
    });
  }
  return items;
}

const CONNECTION_COPY: Record<
  Connection,
  { label: string; title: string; detail: string; tone: string }
> = {
  connecting: {
    label: "Checking",
    title: "Checking control plane",
    detail: "Loading live status.",
    tone: "bg-muted text-muted-foreground",
  },
  connected: {
    label: "Connected",
    title: "Control plane online",
    detail: "Live authority data is available.",
    tone: "bg-emerald-500 text-emerald-500",
  },
  not_configured: {
    label: "Not connected",
    title: "Control plane not connected",
    detail: "Run `caracal up` to provision local credentials.",
    tone: "bg-amber-500 text-amber-500",
  },
  unreachable: {
    label: "Unreachable",
    title: "Control plane unreachable",
    detail: "Confirm the stack is running.",
    tone: "bg-destructive text-destructive",
  },
};

function ControlPlaneSection({
  connection,
  status,
  attentionCount,
}: {
  connection: Connection;
  status: ConsoleStatus | undefined;
  attentionCount: number;
}) {
  const copy = CONNECTION_COPY[connection];

  return (
    <section className="border-y border-border">
      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:bg-background">
        <div className="p-6">
          <SectionLabel>Control plane</SectionLabel>
          <div className="mt-5 flex items-start gap-4">
            <StatusMark connection={connection} />
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {copy.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.detail}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatePill label={copy.label} tone={copy.tone} />
                <StatePill
                  label={`${attentionCount} attention item${attentionCount === 1 ? "" : "s"}`}
                  tone={
                    attentionCount > 0
                      ? "bg-amber-500 text-amber-500"
                      : "bg-muted text-muted-foreground"
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <SectionLabel>Endpoint</SectionLabel>
          <dl className="mt-5 space-y-4">
            <KeyValue label="API" value={status?.apiUrl ?? "—"} mono />
            <KeyValue label="Configured" value={status?.configured ? "Yes" : "No"} />
            <KeyValue label="Reachable" value={status?.reachable ? "Yes" : "No"} />
          </dl>
          <Link
            to="/app/diagnostics"
            className="mt-5 inline-flex h-9 items-center border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Diagnostics
          </Link>
        </div>
      </div>
    </section>
  );
}

function MetricsSection({
  loading,
  countsLoading,
  zones,
  applications,
  resources,
  providers,
  policySets,
}: {
  loading: boolean;
  countsLoading: boolean;
  zones: number;
  applications: number;
  resources: number;
  providers: number;
  policySets: number;
}) {
  const metrics = [
    { label: "Zones", value: zones, to: "/app/zones", loading },
    { label: "Applications", value: applications, to: "/app/applications", loading: countsLoading },
    { label: "Resources", value: resources, to: "/app/resources", loading: countsLoading },
    { label: "Providers", value: providers, to: "/app/providers", loading: countsLoading },
    { label: "Policy sets", value: policySets, to: "/app/policy-sets", loading: countsLoading },
  ];

  return (
    <section>
      <SectionLabel>Live inventory</SectionLabel>
      <div className="mt-4 grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5 [&>*]:bg-background">
        {metrics.map((metric) => (
          <MetricTile key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  to,
  loading,
}: {
  label: string;
  value: number;
  to: string;
  loading: boolean;
}) {
  return (
    <Link to={to} className="group block p-5 transition-colors hover:bg-surface">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-14" />
      ) : (
        <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      )}
      <div className="mt-4 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        Open
      </div>
    </Link>
  );
}

function ZonesSection({
  zones,
  activeId,
  loading,
}: {
  zones: Zone[];
  activeId: string | null;
  loading: boolean;
}) {
  return (
    <section className="min-h-[420px] p-6">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Zones</SectionLabel>
        <DashboardLink to="/app/zones">Manage</DashboardLink>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="mt-8 border border-dashed border-border bg-card/40 p-8">
          <h3 className="text-base font-semibold tracking-tight text-foreground">No zones</h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Create a zone to isolate applications, resources, policies, and audit.
          </p>
          <Link
            to="/app/zones"
            className="mt-5 inline-flex h-9 items-center bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Create zone
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {zones.slice(0, 8).map((zone) => (
            <li key={zone.id}>
              <Link
                to="/app/zones"
                className="grid gap-3 py-4 transition-colors hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {zone.name}
                    </span>
                    {zone.id === activeId ? <Badge tone="success">Active</Badge> : null}
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                    {zone.slug}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(zone.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SetupSection({
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
  const steps = [
    { label: "Zone", done: hasZone, to: "/app/zones" },
    { label: "Provider", done: hasProvider, to: "/app/providers" },
    { label: "Policy set", done: hasPolicySet, to: "/app/policy-sets" },
  ];
  const done = connected ? steps.filter((step) => step.done).length : 0;

  return (
    <section className="p-6">
      <SectionLabel>Setup</SectionLabel>
      {loading ? (
        <Skeleton className="mt-5 h-28 w-full" />
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="text-3xl font-semibold tracking-tight text-foreground">{done}/3</div>
            <div className="text-xs text-muted-foreground">completed</div>
          </div>
          <ul className="mt-5 divide-y divide-border border-y border-border">
            {steps.map((step) => (
              <li key={step.label}>
                <Link
                  to={step.to}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-surface"
                >
                  <span className="text-sm text-foreground">{step.label}</span>
                  <StatusText done={connected && step.done} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function AttentionSection({
  connection,
  loading,
  items,
}: {
  connection: Connection;
  loading: boolean;
  items: AttentionItem[];
}) {
  return (
    <section className="p-6">
      <SectionLabel>Attention</SectionLabel>
      {loading ? (
        <Skeleton className="mt-5 h-20 w-full" />
      ) : connection !== "connected" ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Connect the control plane to view live checks.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">No action required.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.to} className="block py-3 transition-colors hover:bg-surface">
                <span className="flex items-center gap-2">
                  <Badge tone={item.tone === "warning" ? "warning" : "neutral"}>{item.tone}</Badge>
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DiagnosticsSection({
  status,
  connection,
}: {
  status: ConsoleStatus | undefined;
  connection: Connection;
}) {
  return (
    <section className="p-6">
      <SectionLabel>Runtime</SectionLabel>
      <dl className="mt-5 space-y-4">
        <KeyValue label="State" value={CONNECTION_COPY[connection].label} />
        <KeyValue label="API" value={status?.apiUrl ?? "—"} mono />
      </dl>
    </section>
  );
}

function StatusMark({ connection }: { connection: Connection }) {
  const tone =
    connection === "connected"
      ? "bg-emerald-500"
      : connection === "not_configured" || connection === "connecting"
        ? "bg-amber-500"
        : "bg-destructive";
  return (
    <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center border border-border bg-card">
      <span className={cx("h-2.5 w-2.5", tone)} />
    </span>
  );
}

function StatePill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
      <span className={cx("h-1.5 w-1.5", tone)} />
      {label}
    </span>
  );
}

function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cx("truncate text-right text-sm text-foreground", mono && "font-mono text-xs")}
      >
        {value}
      </dd>
    </div>
  );
}

function DashboardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function StatusText({ done }: { done: boolean }) {
  return (
    <span
      className={cx(
        "text-xs font-medium",
        done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      )}
    >
      {done ? "Done" : "Open"}
    </span>
  );
}
