/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides a portal-based field info tooltip that never clips inside scrollable forms.
*/
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";

const PANEL_WIDTH = 280;
const MARGIN = 8;

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </svg>
  );
}

interface Placement {
  top: number;
  left: number;
  side: "top" | "bottom";
}

// A fixed-position popover rendered into document.body so the panel is never clipped by a
// scrollable modal or drawer body. Coordinates are read from the trigger and recomputed on
// scroll and resize so the panel tracks the field while open.
export function InfoHint({ label, className }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.max(
      MARGIN,
      Math.min(center - PANEL_WIDTH / 2, window.innerWidth - PANEL_WIDTH - MARGIN),
    );
    // Prefer above the trigger; flip below when there is not enough headroom.
    const side: Placement["side"] = rect.top > 168 ? "top" : "bottom";
    const top = side === "top" ? rect.top - MARGIN : rect.bottom + MARGIN;
    setPlace({ top, left, side });
  }, []);

  useEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, update]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => event.preventDefault()}
        className={cx(
          "inline-flex flex-shrink-0 cursor-help items-center text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:text-foreground",
          className,
        )}
      >
        <InfoIcon />
      </button>
      {open && place
        ? createPortal(
            <span
              role="tooltip"
              id={id}
              style={{
                position: "fixed",
                top: place.top,
                left: place.left,
                width: PANEL_WIDTH,
                transform: place.side === "top" ? "translateY(-100%)" : undefined,
              }}
              className="animate-fade-in pointer-events-none z-[70] block rounded-md border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-5 text-popover-foreground shadow-lg"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
