/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the collapsible, left-attached Console navigation sidebar.
*/
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { NavIcon } from "@/components/console/NavIcon";
import { LockBadge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { NAV_GROUPS } from "@/platform/nav/navModel";

function isActive(pathname: string, to: string): boolean {
  if (to === "/app") return pathname === "/app";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("transition-transform", collapsed && "rotate-180")}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SidebarItem({
  to,
  label,
  iconName,
  active,
  locked,
  collapsed,
  onNavigate,
}: {
  to: string;
  label: string;
  iconName: string;
  active: boolean;
  locked?: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <li
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        to={to}
        onClick={onNavigate}
        aria-label={label}
        className={cx(
          "group flex items-center rounded-md text-sm transition-colors",
          collapsed ? "h-9 w-9 justify-center" : "gap-3 px-2.5 py-2",
          active
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <span className="relative flex-shrink-0">
          <NavIcon name={iconName} />
          {locked && collapsed ? (
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          ) : null}
        </span>
        {!collapsed ? (
          <>
            <span className="flex-1 truncate">{label}</span>
            {locked ? <LockBadge /> : null}
          </>
        ) : null}
      </Link>
      {collapsed && hover ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
        >
          {label}
          {locked ? <LockBadge /> : null}
        </span>
      ) : null}
    </li>
  );
}

export function Sidebar({
  pathname,
  collapsed,
  onToggle,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div
        className={cx(
          "flex h-14 flex-shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        <Link to="/app" onClick={onNavigate} className="flex items-center gap-2">
          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-foreground text-sm font-bold text-background">
            C
          </span>
          {!collapsed ? (
            <span className="flex flex-col leading-tight">
              <span className="font-mono text-sm font-semibold tracking-tight">Caracal</span>
              <span className="text-[10px] text-muted-foreground">Community Edition</span>
            </span>
          ) : null}
        </Link>
        {!collapsed ? (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        ) : null}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              {!collapsed ? (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </div>
              ) : (
                <div className="mx-auto mb-1 h-px w-6 bg-border first:hidden" />
              )}
              <ul className={cx("flex flex-col gap-0.5", collapsed && "items-center")}>
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    to={item.to}
                    label={item.label}
                    iconName={item.id}
                    active={isActive(pathname, item.to)}
                    locked={item.locked}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {collapsed ? (
        <div className="flex-shrink-0 border-t border-border p-2">
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
