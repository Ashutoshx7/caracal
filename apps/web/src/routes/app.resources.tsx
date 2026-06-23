/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Resources route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { Badge, Field, Modal, Button, useToast, type Column } from "@/components/ui";

export const Route = createFileRoute("/app/resources")({
  component: ResourcesPage,
});

interface ResourceOp {
  method: string;
  path: string;
  scope: string;
}

interface Resource {
  id: string;
  name: string;
  identifier: string;
  scopes: string[];
  upstream: string;
  enforcement: "enforced" | "transport_uniform";
  operations: ResourceOp[];
  createdAt: string;
}

const SEED: Resource[] = [
  {
    id: "r1",
    name: "Billing API",
    identifier: "billing-api",
    scopes: ["invoices:read", "invoices:write"],
    upstream: "https://billing.internal/api",
    enforcement: "enforced",
    operations: [
      { method: "GET", path: "/invoices", scope: "invoices:read" },
      { method: "POST", path: "/invoices", scope: "invoices:write" },
    ],
    createdAt: "2026-05-01",
  },
  {
    id: "r2",
    name: "Warehouse",
    identifier: "warehouse",
    scopes: ["warehouse:read", "warehouse:write"],
    upstream: "https://warehouse.internal",
    enforcement: "enforced",
    operations: [{ method: "GET", path: "/rows", scope: "warehouse:read" }],
    createdAt: "2026-05-04",
  },
  {
    id: "r3",
    name: "Tickets",
    identifier: "tickets",
    scopes: ["tickets:read"],
    upstream: "https://support.internal/v2",
    enforcement: "transport_uniform",
    operations: [],
    createdAt: "2026-05-09",
  },
  {
    id: "r4",
    name: "Events Bus",
    identifier: "events",
    scopes: ["events:publish"],
    upstream: "https://events.internal",
    enforcement: "enforced",
    operations: [{ method: "POST", path: "/publish", scope: "events:publish" }],
    createdAt: "2026-05-14",
  },
  {
    id: "r5",
    name: "CRM",
    identifier: "crm",
    scopes: ["crm:read", "crm:write"],
    upstream: "https://crm.internal/api",
    enforcement: "enforced",
    operations: [
      { method: "GET", path: "/contacts", scope: "crm:read" },
      { method: "PUT", path: "/contacts", scope: "crm:write" },
    ],
    createdAt: "2026-05-22",
  },
  {
    id: "r6",
    name: "Storage",
    identifier: "storage",
    scopes: ["storage:read"],
    upstream: "https://storage.internal",
    enforcement: "transport_uniform",
    operations: [],
    createdAt: "2026-06-02",
  },
  {
    id: "r7",
    name: "Payments",
    identifier: "payments",
    scopes: ["payments:read"],
    upstream: "https://payments.internal/api",
    enforcement: "enforced",
    operations: [{ method: "GET", path: "/charges", scope: "payments:read" }],
    createdAt: "2026-06-07",
  },
  {
    id: "r8",
    name: "Docs Index",
    identifier: "docs",
    scopes: ["docs:read"],
    upstream: "https://docs.internal",
    enforcement: "transport_uniform",
    operations: [],
    createdAt: "2026-06-11",
  },
  {
    id: "r9",
    name: "Jobs",
    identifier: "jobs",
    scopes: ["jobs:read", "jobs:write"],
    upstream: "https://jobs.internal",
    enforcement: "enforced",
    operations: [{ method: "GET", path: "/jobs", scope: "jobs:read" }],
    createdAt: "2026-06-13",
  },
];

function ResourcesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRows(SEED);
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

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
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.upstream}</span>,
    },
    {
      id: "enforcement",
      header: "Enforcement",
      cell: (r) =>
        r.enforcement === "enforced" ? (
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
    <>
      <ResourceWorkspace
        title="Resources"
        description="Protected upstreams the Gateway authorizes in this zone."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Resources" }]}
        primaryAction={{ label: "New resource", onClick: () => setCreateOpen(true) }}
        rows={rows}
        loading={loading}
        columns={columns}
        rowKey={(r) => r.id}
        search={{
          placeholder: "Search resources…",
          match: (r, q) =>
            r.name.toLowerCase().includes(q) ||
            r.identifier.toLowerCase().includes(q) ||
            r.upstream.toLowerCase().includes(q),
        }}
        sortOptions={[
          { id: "name", label: "Name" },
          { id: "recent", label: "Newest" },
        ]}
        empty={{
          title: "No resources yet",
          description: "Register a protected upstream so the Gateway can authorize requests to it.",
          actionLabel: "New resource",
          onAction: () => setCreateOpen(true),
        }}
        detail={{
          title: (r) => r.name,
          description: (r) => r.identifier,
          width: "max-w-lg",
          render: (r) => <ResourceDetail resource={r} />,
        }}
      />

      <CreateResourceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) =>
          toast({ tone: "success", title: "Resource created", description: name })
        }
      />
    </>
  );
}

function ResourceDetail({ resource }: { resource: Resource }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {resource.enforcement === "enforced" ? (
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
          <Mono>{resource.upstream}</Mono>
        </DetailField>
        <DetailField label="Created">{resource.createdAt}</DetailField>
      </DetailGroup>

      <DetailGroup title="Scopes">
        <div className="flex flex-wrap gap-1.5 pt-2">
          {resource.scopes.map((scope) => (
            <Badge key={scope} tone="neutral">
              <Mono>{scope}</Mono>
            </Badge>
          ))}
        </div>
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

function CreateResourceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [upstream, setUpstream] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setUpstream("");
    }
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setBusy(false);
    onCreated(name.trim());
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New resource"
      description="Register a protected upstream for the Gateway to authorize."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            Create resource
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Name"
          placeholder="Billing API"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Field
          label="Upstream URL"
          placeholder="https://billing.internal/api"
          value={upstream}
          onChange={(e) => setUpstream(e.target.value)}
        />
      </div>
    </Modal>
  );
}
