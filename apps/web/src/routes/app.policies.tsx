/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Policies route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/policies")({
  component: PoliciesPage,
});

function PoliciesPage() {
  return (
    <ModulePlaceholder
      title="Policies"
      description="Authored Rego policies that decide authority in this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Policies" }]}
      emptyTitle="No policies yet"
      emptyDescription="Author a policy to start deciding what agents are allowed to do."
    />
  );
}
