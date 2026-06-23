/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the locked enterprise capability route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { SectionLabel } from "@/components/SiteShell";
import { ModulePage } from "@/components/console/ModulePage";
import { Button, LockBadge } from "@/components/ui";
import { config } from "@/platform/config";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";

export const Route = createFileRoute("/app/enterprise/$feature")({
  component: LockedFeaturePage,
});

function LockedFeaturePage() {
  const { feature } = Route.useParams();
  const data = LOCKED_FEATURES[feature];

  if (!data) {
    return (
      <ModulePage title="Enterprise" description="This capability is part of Caracal Enterprise.">
        <div className="border border-border p-6">
          <p className="text-sm text-muted-foreground">Learn more about Caracal Enterprise.</p>
          <a
            className="mt-4 inline-block"
            href={config.enterpriseUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Button>Explore Enterprise</Button>
          </a>
        </div>
      </ModulePage>
    );
  }

  return (
    <ModulePage
      title={data.title}
      description={data.summary}
      breadcrumbs={[
        { label: "Console", to: "/app" },
        { label: "Enterprise" },
        { label: data.title },
      ]}
      actions={<LockBadge />}
    >
      <div className="border border-border">
        <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:bg-background">
          <div className="p-6">
            <SectionLabel>What you get</SectionLabel>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-foreground">
              {data.value.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center gap-3">
              <a href={config.enterpriseUrl} target="_blank" rel="noreferrer">
                <Button>Upgrade to Enterprise</Button>
              </a>
              <a
                href={config.enterpriseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Learn more at caracal.run
              </a>
            </div>
          </div>

          <div className="p-6">
            <SectionLabel>Preview</SectionLabel>
            <div className="mt-5 grid h-44 place-items-center border border-dashed border-border bg-muted/40 text-center">
              <div className="px-4">
                <LockBadge />
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.title} is available in Caracal Enterprise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
