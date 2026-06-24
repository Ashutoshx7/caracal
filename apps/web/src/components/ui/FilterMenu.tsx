/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides a uniform icon-triggered, searchable filter dropdown for Console list pages.
*/
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: FilterOption[];
}

const PANEL_WIDTH = 256;
const MARGIN = 8;

function FunnelIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 5h18l-7 8v5l-4 2v-7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// A single, uniform filter control: a funnel button that opens a searchable dropdown of
// grouped, single-select options. The first option in each group is its default, so the
// control flags "active" whenever any group has moved off its default. Rendered into a
// portal and positioned under the trigger so it never clips inside scrollable headers.
export function FilterMenu({
  groups,
  label = "Filter",
}: {
  groups: FilterGroup[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const activeCount = groups.filter((group) => group.value !== (group.options[0]?.id ?? "")).length;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(
      MARGIN,
      Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - MARGIN),
    );
    setCoords({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onScrollResize = () => place();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      options: q
        ? group.options.filter((option) => option.label.toLowerCase().includes(q))
        : group.options,
    }))
    .filter((group) => group.options.length > 0);

  function reset() {
    for (const group of groups) {
      const first = group.options[0]?.id;
      if (first !== undefined && group.value !== first) group.onChange(first);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "relative inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          open || activeCount > 0
            ? "border-foreground/20 bg-accent text-foreground"
            : "border-border text-muted-foreground hover:bg-surface hover:text-foreground",
        )}
      >
        <FunnelIcon />
        {label}
        {activeCount > 0 ? (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="dialog"
              aria-label={label}
              style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_WIDTH }}
              className="animate-pop-in z-[70] flex max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={activeCount === 0}
                  className="text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Reset
                </button>
              </div>

              <div className="border-b border-border p-2">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search options…"
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
              </div>

              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
                {visibleGroups.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches.</p>
                ) : (
                  visibleGroups.map((group, index) => (
                    <div
                      key={group.id}
                      className={cx(index > 0 && "mt-1.5 border-t border-border pt-1.5")}
                    >
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {group.label}
                      </div>
                      {group.options.map((option) => {
                        const selected = option.id === group.value;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => group.onChange(option.id)}
                            className={cx(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus-visible:bg-accent",
                              selected
                                ? "bg-accent/60 text-foreground"
                                : "text-foreground hover:bg-accent/50",
                            )}
                          >
                            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-foreground">
                              {selected ? <CheckIcon /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            {option.count !== undefined ? (
                              <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                                {option.count}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
