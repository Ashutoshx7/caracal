/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Diagnostics route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/diagnostics")({
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  return (
    <ModulePlaceholder
      title="Diagnostics"
      description="Readiness and configuration checks for the control plane."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Diagnostics" }]}
      emptyTitle="Diagnostics ready"
      emptyDescription="Run a check to surface configuration gaps before they reach production."
    />
  );
}
