/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Agents route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <ModulePlaceholder
      title="Agents"
      description="Live agent sessions and their delegation lineage."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Agents" }]}
      emptyTitle="No agents running"
      emptyDescription="Running agent sessions and their lineage appear here in real time."
    />
  );
}
