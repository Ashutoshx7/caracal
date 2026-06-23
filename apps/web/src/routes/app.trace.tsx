/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Request Trace route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/trace")({
  component: TracePage,
});

function TracePage() {
  return (
    <ModulePlaceholder
      title="Request Trace"
      description="Follow a single request through every decision it triggered."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Request Trace" }]}
      emptyTitle="No request selected"
      emptyDescription="Open a request from Audit to trace its full decision path here."
    />
  );
}
