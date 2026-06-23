/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Applications route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { Badge, Button, Field, Modal, Textarea, useToast, type Column } from "@/components/ui";

export const Route = createFileRoute("/app/applications")({
  component: ApplicationsPage,
});

type Registration = "console" | "dcr";

interface Application {
  id: string;
  name: string;
  clientId: string;
  registration: Registration;
  scopes: string[];
  status: "active" | "expired";
  lastSeen: string;
  createdAt: string;
}

const SEED: Application[] = [
  {
    id: "a1",
    name: "billing-worker",
    clientId: "cli_8f2a91c4",
    registration: "console",
    scopes: ["invoices:read", "invoices:write"],
    status: "active",
    lastSeen: "2m ago",
    createdAt: "2026-05-12",
  },
  {
    id: "a2",
    name: "support-agent",
    clientId: "cli_2b7d04e1",
    registration: "dcr",
    scopes: ["tickets:read"],
    status: "active",
    lastSeen: "11m ago",
    createdAt: "2026-05-20",
  },
  {
    id: "a3",
    name: "etl-pipeline",
    clientId: "cli_55c9aa30",
    registration: "console",
    scopes: ["warehouse:read", "warehouse:write"],
    status: "active",
    lastSeen: "1h ago",
    createdAt: "2026-04-30",
  },
  {
    id: "a4",
    name: "notify-bot",
    clientId: "cli_a01ff7b2",
    registration: "dcr",
    scopes: ["events:publish"],
    status: "expired",
    lastSeen: "6d ago",
    createdAt: "2026-03-18",
  },
  {
    id: "a5",
    name: "scheduler",
    clientId: "cli_77de1290",
    registration: "console",
    scopes: ["jobs:read", "jobs:write"],
    status: "active",
    lastSeen: "20m ago",
    createdAt: "2026-05-02",
  },
  {
    id: "a6",
    name: "audit-exporter",
    clientId: "cli_3c8b6e45",
    registration: "console",
    scopes: ["audit:read"],
    status: "active",
    lastSeen: "3h ago",
    createdAt: "2026-05-25",
  },
  {
    id: "a7",
    name: "doc-indexer",
    clientId: "cli_9a14f0d7",
    registration: "dcr",
    scopes: ["docs:read"],
    status: "active",
    lastSeen: "44m ago",
    createdAt: "2026-06-01",
  },
  {
    id: "a8",
    name: "payments-reconciler",
    clientId: "cli_61ab22ce",
    registration: "console",
    scopes: ["payments:read"],
    status: "active",
    lastSeen: "8m ago",
    createdAt: "2026-06-08",
  },
  {
    id: "a9",
    name: "lead-enricher",
    clientId: "cli_0fd7c3a8",
    registration: "dcr",
    scopes: ["crm:read", "crm:write"],
    status: "active",
    lastSeen: "2h ago",
    createdAt: "2026-06-10",
  },
  {
    id: "a10",
    name: "backup-runner",
    clientId: "cli_d24e90b1",
    registration: "console",
    scopes: ["storage:read"],
    status: "active",
    lastSeen: "30m ago",
    createdAt: "2026-06-12",
  },
];

function ApplicationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRows(SEED);
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const columns: Column<Application>[] = [
    {
      id: "name",
      header: "Application",
      sortable: true,
      cell: (app) => (
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {app.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="font-medium text-foreground">{app.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{app.clientId}</div>
          </div>
        </div>
      ),
    },
    {
      id: "registration",
      header: "Registration",
      cell: (app) => (
        <Badge tone="neutral">{app.registration === "dcr" ? "Dynamic (DCR)" : "Console"}</Badge>
      ),
    },
    {
      id: "scopes",
      header: "Scopes",
      cell: (app) => <span className="text-sm text-muted-foreground">{app.scopes.length}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (app) =>
        app.status === "active" ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="muted">Expired</Badge>
        ),
    },
    {
      id: "lastSeen",
      header: "Last seen",
      sortable: true,
      align: "right",
      cell: (app) => <span className="text-xs text-muted-foreground">{app.lastSeen}</span>,
    },
  ];

  return (
    <>
      <ResourceWorkspace
        title="Applications"
        description="Agent identities that can request authority in this zone."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Applications" }]}
        primaryAction={{ label: "New application", onClick: () => setCreateOpen(true) }}
        rows={rows}
        loading={loading}
        columns={columns}
        rowKey={(app) => app.id}
        search={{
          placeholder: "Search applications…",
          match: (app, q) =>
            app.name.toLowerCase().includes(q) || app.clientId.toLowerCase().includes(q),
        }}
        sortOptions={[
          { id: "recent", label: "Recently active" },
          { id: "name", label: "Name" },
        ]}
        empty={{
          title: "No applications yet",
          description: "Create an application to give an agent a scoped identity in this zone.",
          actionLabel: "New application",
          onAction: () => setCreateOpen(true),
        }}
        detail={{
          title: (app) => app.name,
          description: (app) => app.clientId,
          render: (app) => <ApplicationDetail app={app} onToast={toast} />,
        }}
      />

      <CreateApplicationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) =>
          toast({ tone: "success", title: "Application created", description: name })
        }
      />
    </>
  );
}

function ApplicationDetail({
  app,
  onToast,
}: {
  app: Application;
  onToast: (t: { tone: "success" | "info" | "error"; title: string; description?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {app.status === "active" ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="muted">Expired</Badge>
        )}
        <Badge tone="neutral">{app.registration === "dcr" ? "Dynamic (DCR)" : "Console"}</Badge>
      </div>

      <DetailGroup title="Identity">
        <DetailField label="Name">{app.name}</DetailField>
        <DetailField label="Client ID">
          <Mono>{app.clientId}</Mono>
        </DetailField>
        <DetailField label="Created">{app.createdAt}</DetailField>
        <DetailField label="Last seen">{app.lastSeen}</DetailField>
      </DetailGroup>

      <DetailGroup title="Scopes">
        <div className="flex flex-wrap gap-1.5 pt-2">
          {app.scopes.map((scope) => (
            <Badge key={scope} tone="neutral">
              <Mono>{scope}</Mono>
            </Badge>
          ))}
        </div>
      </DetailGroup>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onToast({ tone: "success", title: "Client secret rotated", description: app.name })
          }
        >
          Rotate secret
        </Button>
      </div>
    </div>
  );
}

function CreateApplicationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setScopes("");
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
      title="New application"
      description="Give an agent a scoped identity in this zone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            Create application
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Name"
          placeholder="billing-worker"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Scopes"
          hint="Optional. Comma-separated scopes this application may request."
          placeholder="invoices:read, invoices:write"
          value={scopes}
          onChange={(e) => setScopes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
