/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Providers route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  return (
    <ModulePlaceholder
      title="Providers"
      description="Credential sources that issue upstream access for this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Providers" }]}
      emptyTitle="No providers configured"
      emptyDescription="Add an identity provider so applications can obtain mandates and upstream credentials."
    />
  );
}
