/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders an informative module surface for capabilities served outside the web control path.
*/
import type { ReactNode } from "react";

import { SectionLabel } from "@/components/SiteShell";
import { ModulePage } from "@/components/console/ModulePage";
import type { Crumb } from "@/components/ui";

export function ModuleNotice({
  title,
  description,
  breadcrumbs,
  noticeTitle,
  children,
}: {
  title: string;
  description: string;
  breadcrumbs: Crumb[];
  noticeTitle: string;
  children: ReactNode;
}) {
  return (
    <ModulePage title={title} description={description} breadcrumbs={breadcrumbs}>
      <div className="border border-border p-6">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center border border-border bg-card text-muted-foreground">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
          </span>
          <div className="min-w-0">
            <SectionLabel>Service boundary</SectionLabel>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">
              {noticeTitle}
            </h2>
            <div className="mt-3 flex max-w-2xl flex-col gap-3 text-sm text-muted-foreground">
              {children}
            </div>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
