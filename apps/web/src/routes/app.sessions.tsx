/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Sessions route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <ModulePlaceholder
      title="Sessions"
      description="Active authority sessions issued in this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Sessions" }]}
      emptyTitle="No active sessions"
      emptyDescription="Authority sessions appear here once agents begin acting in this zone."
    />
  );
}
