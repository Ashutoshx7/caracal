/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the always-visible navbar platform health indicator that links to Diagnostics.
*/
import { useNavigate } from "@tanstack/react-router";

import { cx } from "@/lib/cx";
import { platformHealthOf, useDiagnostics, type PlatformHealth } from "@/platform/api/hooks";

interface Tone {
  dot: string;
  glow: string;
  pill: string;
  text: string;
  pulse: boolean;
  label: string;
}

const TONE: Record<PlatformHealth, Tone> = {
  healthy: {
    dot: "bg-emerald-500",
    glow: "ring-2 ring-emerald-500/20",
    pill: "border-emerald-500/20 bg-emerald-500/[0.07] hover:bg-emerald-500/10 hover:border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    pulse: true,
    label: "All systems healthy",
  },
  attention: {
    dot: "bg-amber-500",
    glow: "ring-2 ring-amber-500/25",
    pill: "border-amber-500/25 bg-amber-500/[0.08] hover:bg-amber-500/[0.12] hover:border-amber-500/35",
    text: "text-amber-700 dark:text-amber-300",
    pulse: true,
    label: "Degraded",
  },
  unhealthy: {
    dot: "bg-destructive",
    glow: "ring-2 ring-destructive/25",
    pill: "border-destructive/25 bg-destructive/[0.08] hover:bg-destructive/[0.12] hover:border-destructive/35",
    text: "text-destructive",
    pulse: true,
    label: "Failures",
  },
  unknown: {
    dot: "bg-muted-foreground/60",
    glow: "",
    pill: "border-border bg-background hover:bg-accent hover:border-ring/50",
    text: "text-muted-foreground",
    pulse: false,
    label: "Checking…",
  },
};

export function PlatformStatus() {
  const navigate = useNavigate();
  const diagnostics = useDiagnostics();
  const health = diagnostics.isError ? "unhealthy" : platformHealthOf(diagnostics.data);
  const tone = TONE[health];

  const summary = diagnostics.data?.summary;
  const label = diagnostics.isError
    ? "Diagnostics unavailable"
    : summary
      ? health === "healthy"
        ? "All systems operational"
        : [
            summary.fail > 0 ? `${summary.fail} failing` : null,
            summary.warn > 0 ? `${summary.warn} degraded` : null,
          ]
            .filter(Boolean)
            .join(" · ")
      : tone.label;

  return (
    <button
      onClick={() => navigate({ to: "/app/diagnostics" })}
      aria-label={`Platform status: ${tone.label}. Open Diagnostics.`}
      title={`${tone.label} — open Diagnostics`}
      className={cx(
        "group inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium tabular-nums",
        "shadow-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/40",
        tone.pill,
      )}
    >
      <span className="relative flex h-2 w-2 flex-shrink-0 items-center justify-center">
        {tone.pulse ? (
          <span
            className={cx(
              "absolute inline-flex h-2 w-2 rounded-full opacity-60",
              tone.dot,
              health === "healthy" ? "animate-ping" : "animate-pulse",
            )}
          />
        ) : null}
        <span className={cx("relative h-1.5 w-1.5 rounded-full", tone.dot, tone.glow)} />
      </span>
      <span className={cx("hidden whitespace-nowrap lg:inline", tone.text)}>{label}</span>
    </button>
  );
}
