/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Resources route.
*/
import { createFileRoute } from "@tanstack/react-router";

import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { ZoneScopedPage } from "@/components/console/ZoneScope";
import { Badge, type Column } from "@/components/ui";
import { ConsoleApiError } from "@/platform/api/client";
import { useResources } from "@/platform/api/hooks";
import type { Resource } from "@/platform/api/types";

export const Route = createFileRoute("/app/resources")({
  component: ResourcesRoute,
});

function ResourcesRoute() {
  return (
    <ZoneScopedPage
      title="Resources"
      description="Protected upstreams the Gateway authorizes in this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Resources" }]}
    >
      {(zone) => <ResourcesPage zoneId={zone.id} />}
    </ZoneScopedPage>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ConsoleApiError) {
    if (error.notConfigured) return "Control plane not connected.";
    if (error.unreachable) return "Control plane unreachable.";
    return error.code;
  }
  return "Unexpected error.";
}

function ResourcesPage({ zoneId }: { zoneId: string }) {
  const query = useResources(zoneId);
  const rows = query.data ?? [];

  const columns: Column<Resource>[] = [
    {
      id: "name",
      header: "Resource",
      sortable: true,
      cell: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.identifier}</div>
        </div>
      ),
    },
    {
      id: "upstream",
      header: "Upstream",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.upstream_url ?? "—"}</span>
      ),
    },
    {
      id: "enforcement",
      header: "Enforcement",
      cell: (r) =>
        r.operation_enforcement === "enforced" ? (
          <Badge tone="success">Enforced</Badge>
        ) : (
          <Badge tone="muted">Transport</Badge>
        ),
    },
    {
      id: "scopes",
      header: "Scopes",
      align: "right",
      cell: (r) => <span className="text-sm text-muted-foreground">{r.scopes.length}</span>,
    },
  ];

  return (
    <ResourceWorkspace
      title="Resources"
      description="Protected upstreams the Gateway authorizes in this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Resources" }]}
      rows={rows}
      loading={query.isLoading}
      columns={columns}
      rowKey={(r) => r.id}
      search={{
        placeholder: "Search resources…",
        match: (r, q) =>
          r.name.toLowerCase().includes(q) ||
          r.identifier.toLowerCase().includes(q) ||
          (r.upstream_url ?? "").toLowerCase().includes(q),
      }}
      sortOptions={[
        { id: "name", label: "Name" },
        { id: "recent", label: "Newest" },
      ]}
      empty={{
        title: query.isError ? "Could not load resources" : "No resources yet",
        description: query.isError
          ? errorMessage(query.error)
          : "Register a protected upstream so the Gateway can authorize requests to it.",
      }}
      detail={{
        title: (r) => r.name,
        description: (r) => r.identifier,
        width: "max-w-lg",
        render: (r) => <ResourceDetail resource={r} />,
      }}
    />
  );
}

function ResourceDetail({ resource }: { resource: Resource }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {resource.operation_enforcement === "enforced" ? (
          <Badge tone="success">Operation enforced</Badge>
        ) : (
          <Badge tone="muted">Transport uniform</Badge>
        )}
      </div>

      <DetailGroup title="Routing">
        <DetailField label="Identifier">
          <Mono>{resource.identifier}</Mono>
        </DetailField>
        <DetailField label="Upstream URL">
          <Mono>{resource.upstream_url ?? "—"}</Mono>
        </DetailField>
        <DetailField label="Created">{new Date(resource.created_at).toLocaleString()}</DetailField>
      </DetailGroup>

      <DetailGroup title="Scopes">
        {resource.scopes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {resource.scopes.map((scope) => (
              <Badge key={scope} tone="neutral">
                <Mono>{scope}</Mono>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="pt-2 text-sm text-muted-foreground">No scopes declared.</p>
        )}
      </DetailGroup>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Operations
        </h3>
        {resource.operations.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {resource.operations.map((op) => (
                  <tr key={`${op.method}-${op.path}`}>
                    <td className="px-3 py-2">
                      <Badge tone="neutral">{op.method}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{op.path}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {op.scope}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No declared operations. Authorization is uniform across the transport.
          </p>
        )}
      </section>
    </div>
  );
}
