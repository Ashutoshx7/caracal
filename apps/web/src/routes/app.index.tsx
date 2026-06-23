/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Console dashboard overview route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Button, Card, LockBadge, SectionTitle, Skeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";
import {
  activeZones,
  getActiveZone,
  workspaceLabel,
  type ZoneRecord,
} from "@/platform/state/localInstall";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

type Health = "healthy" | "degraded" | "down";
type AttentionLevel = "warning" | "info";

interface Snapshot {
  zones: ZoneRecord[];
  activeZone: ZoneRecord | null;
  counts: {
    applications: number;
    resources: number;
    providers: number;
    policySets: number;
    agents: number;
  };
  audit: { decisions24h: number; allow: number; deny: number };
  services: { name: string; status: Health }[];
  attention: { id: string; level: AttentionLevel; title: string; detail: string; to: string }[];
  activity: {
    id: string;
    text: string;
    when: string;
    kind: "policy" | "auth" | "object" | "session";
  }[];
  setup: { id: string; label: string; done: boolean; to: string }[];
}

/** Build a dashboard snapshot from local state plus representative operational status. */
function buildSnapshot(): Snapshot {
  const zones = activeZones();
  const activeZone = getActiveZone();
  const hasZone = zones.length > 0;

  const setup = [
    { id: "zone", label: "Create your first zone", done: hasZone, to: "/app/zones" },
    { id: "provider", label: "Connect an identity provider", done: false, to: "/app/providers" },
    { id: "policy", label: "Activate a policy set", done: false, to: "/app/policy-sets" },
    { id: "control", label: "Issue a Control API key", done: false, to: "/app/control" },
  ];

  const attention: Snapshot["attention"] = [];
  if (activeZone) {
    attention.push({
      id: "no-policy-set",
      level: "warning",
      title: "No active policy set",
      detail: `Zone ${activeZone.name} has no policy set activated. Requests fall back to deny.`,
      to: "/app/policy-sets",
    });
    attention.push({
      id: "no-provider",
      level: "info",
      title: "No identity provider configured",
      detail: `Add a provider to ${activeZone.name} so applications can obtain mandates.`,
      to: "/app/providers",
    });
  }

  return {
    zones,
    activeZone,
    counts: { applications: 6, resources: 4, providers: 0, policySets: 2, agents: 3 },
    audit: { decisions24h: 1284, allow: 1190, deny: 94 },
    services: [
      { name: "Gateway", status: "healthy" },
      { name: "STS", status: "healthy" },
      { name: "Coordinator", status: "healthy" },
      { name: "Audit", status: "healthy" },
    ],
    attention,
    activity: [
      { id: "a1", text: "Policy set v3 activated", when: "2m ago", kind: "policy" },
      { id: "a2", text: "Agent session delegated read scope", when: "18m ago", kind: "session" },
      { id: "a3", text: "Application acme-worker created", when: "1h ago", kind: "object" },
      { id: "a4", text: "Resource billing-api updated", when: "3h ago", kind: "object" },
      { id: "a5", text: "Control key rotated", when: "5h ago", kind: "auth" },
    ],
    setup,
  };
}

function relativeTime(from: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - from) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function DashboardPage() {
  const workspace = workspaceLabel();
  const [data, setData] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const [, force] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((initial: boolean) => {
    if (initial) setData(null);
    else setRefreshing(true);
    timer.current = setTimeout(
      () => {
        setData(buildSnapshot());
        setUpdatedAt(Date.now());
        setRefreshing(false);
      },
      initial ? 450 : 600,
    );
  }, []);

  useEffect(() => {
    load(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  // Keep the "updated Xs ago" label fresh without refetching.
  useEffect(() => {
    const tick = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(tick);
  }, []);

  const loading = data === null;
  const activeName = data?.activeZone?.name ?? null;

  return (
    <ModulePage
      title="Dashboard"
      description={
        activeName ? `Operating ${workspace} · active zone ${activeName}` : `Operating ${workspace}`
      }
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Dashboard" }]}
      actions={
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {refreshing ? "Refreshing…" : `Updated ${relativeTime(updatedAt)}`}
          </span>
          <Button variant="secondary" size="sm" onClick={() => load(false)} loading={refreshing}>
            Refresh
          </Button>
        </div>
      }
    >
      <StatusHero data={data} loading={loading} />

      <Attention data={data} loading={loading} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ZonesPanel data={data} loading={loading} />
          <ActivityPanel data={data} loading={loading} />
        </div>
        <div className="flex flex-col gap-4">
          <SetupPanel data={data} loading={loading} />
          <HealthPanel data={data} loading={loading} />
          <AuditPanel data={data} loading={loading} />
        </div>
      </div>

      <EnterprisePanel />
    </ModulePage>
  );
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

function StatusDot({ status }: { status: Health }) {
  const tone = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-destructive",
  }[status];
  return <span className={cx("inline-block h-2 w-2 rounded-full", tone)} />;
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

function StatusHero({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  const allHealthy = data ? data.services.every((s) => s.status === "healthy") : true;
  const issues = data?.attention.length ?? 0;
  const status: Health = !data
    ? "healthy"
    : !allHealthy
      ? "down"
      : issues > 0
        ? "degraded"
        : "healthy";
  const headline = !allHealthy
    ? "Service disruption detected"
    : issues > 0
      ? "Operational — items need attention"
      : "All systems operational";

  return (
    <Card className="bg-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              "grid h-10 w-10 place-items-center rounded-full",
              status === "healthy" && "bg-emerald-500/15",
              status === "degraded" && "bg-amber-500/15",
              status === "down" && "bg-destructive/15",
            )}
          >
            <StatusDot status={status} />
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight text-foreground">{headline}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              Secure authority and control plane for your agents, policies, and zones.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Zones" value={data?.zones.length ?? 0} to="/app/zones" loading={loading} />
        <Metric
          label="Applications"
          value={data?.counts.applications ?? 0}
          to="/app/applications"
          loading={loading}
        />
        <Metric
          label="Resources"
          value={data?.counts.resources ?? 0}
          to="/app/resources"
          loading={loading}
        />
        <Metric
          label="Policy sets"
          value={data?.counts.policySets ?? 0}
          to="/app/policy-sets"
          loading={loading}
        />
        <Metric
          label="Agent sessions"
          value={data?.counts.agents ?? 0}
          to="/app/agents"
          loading={loading}
        />
      </div>
    </Card>
  );
}

function Attention({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  if (loading) {
    return (
      <Card className="mt-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
      </Card>
    );
  }
  const items = data?.attention ?? [];
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
      <SectionHeader
        title={`Needs attention · ${items.length}`}
        action={<ViewAll to="/app/diagnostics" label="Diagnostics" />}
      />
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
              <span className="mt-1 text-muted-foreground">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ZonesPanel({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  return (
    <Card>
      <SectionHeader title="Zones" action={<ViewAll to="/app/zones" />} />
      {loading ? (
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data && data.zones.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {data.zones.slice(0, 4).map((zone) => {
            const isActive = zone.id === data.activeZone?.id;
            return (
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
                      {isActive ? <Badge tone="success">Active</Badge> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {zone.description || zone.slug}
                    </span>
                  </span>
                  <StatusDot status="healthy" />
                </Link>
              </li>
            );
          })}
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

function ActivityPanel({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  return (
    <Card>
      <SectionHeader
        title="Recent activity"
        action={<ViewAll to="/app/audit" label="Open audit" />}
      />
      {loading ? (
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {(data?.activity ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <ActivityGlyph kind={item.kind} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.text}</span>
              <span className="flex-shrink-0 text-xs text-muted-foreground">{item.when}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityGlyph({ kind }: { kind: "policy" | "auth" | "object" | "session" }) {
  const tone = {
    policy: "text-violet-500",
    auth: "text-amber-500",
    object: "text-muted-foreground",
    session: "text-emerald-500",
  }[kind];
  return (
    <span className={cx("flex-shrink-0", tone)}>
      <span className="block h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

function SetupPanel({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  const setup = data?.setup ?? [];
  const done = setup.filter((s) => s.done).length;
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

function HealthPanel({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  return (
    <Card>
      <SectionHeader
        title="Service health"
        action={<ViewAll to="/app/diagnostics" label="Diagnostics" />}
      />
      {loading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {(data?.services ?? []).map((service) => (
            <li key={service.name} className="flex items-center justify-between">
              <span className="text-foreground">{service.name}</span>
              <span className="flex items-center gap-2">
                <StatusDot status={service.status} />
                <span className="text-xs capitalize text-muted-foreground">{service.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AuditPanel({ data, loading }: { data: Snapshot | null; loading: boolean }) {
  return (
    <Card>
      <SectionHeader title="Authority decisions" action={<ViewAll to="/app/audit" />} />
      {loading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {data?.audit.decisions24h.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">decisions · 24h</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone="success">{data?.audit.allow.toLocaleString()} allow</Badge>
            <Badge tone="warning">{data?.audit.deny.toLocaleString()} deny</Badge>
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
