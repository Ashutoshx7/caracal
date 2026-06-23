/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the navbar search affordance that opens the command palette.
*/
import { useEffect, useState } from "react";

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
}

export function CommandTrigger({ onOpen }: { onOpen: () => void }) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(isMac());
  }, []);

  return (
    <button
      onClick={onOpen}
      aria-label="Open command palette"
      className="flex h-9 items-center gap-2 rounded-md border border-border bg-background pl-2.5 pr-2 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <span className="hidden w-40 text-left lg:inline">Search or jump to…</span>
      <kbd className="hidden flex-shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:block">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
