/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file is the authenticated Console shell: a left-attached collapsible sidebar and a top navbar with the profile menu.
*/
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ProfileMenu } from "@/components/console/ProfileMenu";
import { Sidebar } from "@/components/console/Sidebar";
import { cx } from "@/lib/cx";
import { useActiveZone } from "@/platform/api/hooks";

const COLLAPSE_KEY = "caracal.sidebar.collapsed";

function readCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(COLLAPSE_KEY) === "1";
}

export function ConsoleLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { activeZone } = useActiveZone();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cx(
          "hidden flex-shrink-0 border-r border-border transition-[width] duration-200 md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Sidebar
          pathname={pathname}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-60 border-r border-border bg-background shadow-xl">
            <Sidebar
              pathname={pathname}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {activeZone ? (
              <Link
                to="/app/zones"
                className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-foreground text-[10px] font-bold text-background">
                  Z
                </span>
                <span className="max-w-[12rem] truncate font-medium text-foreground">
                  {activeZone.name}
                </span>
              </Link>
            ) : (
              <Link
                to="/app/zones"
                className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                No active zone
              </Link>
            )}
          </div>

          <ProfileMenu />
        </header>

        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
