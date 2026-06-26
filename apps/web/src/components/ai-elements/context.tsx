/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Context token-usage component family ported to the Caracal design system.
*/
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cx } from "@/lib/cx";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

export interface ContextUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

type ContextSchema = {
  usedTokens: number;
  maxTokens: number;
  usage?: ContextUsage;
  modelId?: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
  const context = useContext(ContextContext);
  if (!context) {
    throw new Error("Context components must be used within Context");
  }
  return context;
};

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);

const percent = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);

export type ContextProps = Omit<ComponentProps<"div">, "children"> & {
  usedTokens: number;
  maxTokens: number;
  usage?: ContextUsage;
  modelId?: string | null;
  children: ReactNode;
};

// Root provider and hover/click controller. Replaces the upstream HoverCard with a
// self-contained popover so the component carries no third-party UI dependency.
export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  className,
  children,
  ...props
}: ContextProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <ContextContext.Provider value={{ usedTokens, maxTokens, usage, modelId, open, setOpen }}>
      <div
        ref={ref}
        className={cx("relative inline-flex", className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        {children}
      </div>
    </ContextContext.Provider>
  );
};

const ContextIcon = () => {
  const { usedTokens, maxTokens } = useContextValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = maxTokens > 0 ? usedTokens / maxTokens : 0;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label="Model context usage"
      height="16"
      role="img"
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="16"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.3"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        className="text-accent-purple"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
      />
    </svg>
  );
};

export type ContextTriggerProps = ComponentProps<"button">;

export const ContextTrigger = ({ children, className, ...props }: ContextTriggerProps) => {
  const { open, setOpen } = useContextValue();

  return (
    <button
      type="button"
      aria-label="Model context usage"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onFocus={() => setOpen(true)}
      className={cx(
        "inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    >
      {children ?? <ContextIcon />}
    </button>
  );
};

export type ContextContentProps = ComponentProps<"div"> & {
  placement?: "top" | "bottom";
};

export const ContextContent = ({
  className,
  children,
  placement = "bottom",
  ...props
}: ContextContentProps) => {
  const { open } = useContextValue();
  if (!open) return null;
  return (
    <div
      role="dialog"
      className={cx(
        "animate-fade-in absolute right-0 z-50 min-w-60 divide-y divide-border overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
        placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export type ContextContentHeaderProps = ComponentProps<"div">;

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = maxTokens > 0 ? usedTokens / maxTokens : 0;

  return (
    <div className={cx("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="text-foreground">{maxTokens > 0 ? percent(usedPercent) : "Usage"}</p>
            <p className="font-mono text-muted-foreground">
              {compact(usedTokens)}
              {maxTokens > 0 ? ` / ${compact(maxTokens)}` : ""}
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent-purple transition-[width]"
              style={{ width: `${Math.min(PERCENT_MAX, usedPercent * PERCENT_MAX)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({ children, className, ...props }: ContextContentBodyProps) => (
  <div className={cx("w-full space-y-1.5 p-3", className)} {...props}>
    {children}
  </div>
);

export type ContextContentFooterProps = ComponentProps<"div">;

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { modelId, usage } = useContextValue();
  const total = usage?.totalTokens ?? 0;

  return (
    <div
      className={cx(
        "flex w-full items-center justify-between gap-3 bg-surface p-3 text-xs",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="truncate font-mono text-muted-foreground">{modelId ?? "no model"}</span>
          <span className="text-foreground">{compact(total)} total</span>
        </>
      )}
    </div>
  );
};

const UsageRow = ({ label, tokens }: { label: string; tokens: number }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground">{compact(tokens)}</span>
  </div>
);

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({ children }: ContextInputUsageProps) => {
  const { usage } = useContextValue();
  if (children) return <>{children}</>;
  const tokens = usage?.inputTokens ?? 0;
  if (!tokens) return null;
  return <UsageRow label="Input" tokens={tokens} />;
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({ children }: ContextOutputUsageProps) => {
  const { usage } = useContextValue();
  if (children) return <>{children}</>;
  const tokens = usage?.outputTokens ?? 0;
  if (!tokens) return null;
  return <UsageRow label="Output" tokens={tokens} />;
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({ children }: ContextReasoningUsageProps) => {
  const { usage } = useContextValue();
  if (children) return <>{children}</>;
  const tokens = usage?.reasoningTokens ?? 0;
  if (!tokens) return null;
  return <UsageRow label="Reasoning" tokens={tokens} />;
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({ children }: ContextCacheUsageProps) => {
  const { usage } = useContextValue();
  if (children) return <>{children}</>;
  const tokens = usage?.cachedInputTokens ?? 0;
  if (!tokens) return null;
  return <UsageRow label="Cache" tokens={tokens} />;
};
