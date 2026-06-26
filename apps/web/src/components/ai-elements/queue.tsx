/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Queue disclosure component family ported to the Caracal design system.
*/
import { createContext, useContext, useState, type ComponentProps } from "react";

import { cx } from "@/lib/cx";

const ChevronGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 12l5 5 9-10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export type QueueProps = ComponentProps<"div">;

// Root container for the queue. It carries no UI dependency and simply stacks its
// sections, matching the rest of the ported element family.
export const Queue = ({ className, children, ...props }: QueueProps) => (
  <div className={cx("flex flex-col", className)} {...props}>
    {children}
  </div>
);

type QueueSectionSchema = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const QueueSectionContext = createContext<QueueSectionSchema | null>(null);

const useQueueSection = () => {
  const context = useContext(QueueSectionContext);
  if (!context) {
    throw new Error("QueueSection components must be used within QueueSection");
  }
  return context;
};

export type QueueSectionProps = ComponentProps<"div"> & {
  defaultOpen?: boolean;
};

// A collapsible group of queue items. With no third-party collapsible it owns its own
// open state, so a trigger and content pair disclose together without a UI dependency.
export const QueueSection = ({
  defaultOpen = true,
  className,
  children,
  ...props
}: QueueSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <QueueSectionContext.Provider value={{ open, setOpen }}>
      <div className={cx("border-b border-border last:border-b-0", className)} {...props}>
        {children}
      </div>
    </QueueSectionContext.Provider>
  );
};

export type QueueSectionTriggerProps = ComponentProps<"button">;

export const QueueSectionTrigger = ({
  className,
  children,
  ...props
}: QueueSectionTriggerProps) => {
  const { open, setOpen } = useQueueSection();
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cx(
        "flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    >
      <ChevronGlyph
        className={cx("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")}
      />
      {children}
    </button>
  );
};

export type QueueSectionLabelProps = ComponentProps<"span"> & {
  label: string;
  count: number;
};

export const QueueSectionLabel = ({
  label,
  count,
  className,
  ...props
}: QueueSectionLabelProps) => (
  <span className={cx("flex items-center gap-1.5", className)} {...props}>
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </span>
    <span className="rounded-full border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
      {count}
    </span>
  </span>
);

export type QueueSectionContentProps = ComponentProps<"div">;

export const QueueSectionContent = ({
  className,
  children,
  ...props
}: QueueSectionContentProps) => {
  const { open } = useQueueSection();
  if (!open) return null;
  return (
    <div className={cx("flex flex-col pb-1.5", className)} {...props}>
      {children}
    </div>
  );
};

export type QueueListProps = ComponentProps<"div">;

export const QueueList = ({ className, children, ...props }: QueueListProps) => (
  <div className={cx("flex flex-col", className)} {...props}>
    {children}
  </div>
);

export type QueueItemProps = ComponentProps<"div">;

export const QueueItem = ({ className, children, ...props }: QueueItemProps) => (
  <div
    className={cx("flex items-start gap-2 px-3 py-1.5 hover:bg-accent/40", className)}
    {...props}
  >
    {children}
  </div>
);

export type QueueItemIndicatorProps = ComponentProps<"span"> & {
  completed?: boolean;
  failed?: boolean;
};

export const QueueItemIndicator = ({
  completed = false,
  failed = false,
  className,
  ...props
}: QueueItemIndicatorProps) => (
  <span
    className={cx(
      "mt-0.5 grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full border",
      completed
        ? "border-emerald-500 bg-emerald-500 text-white"
        : failed
          ? "border-destructive text-destructive"
          : "border-muted-foreground/40",
      className,
    )}
    {...props}
  >
    {completed ? <CheckGlyph className="h-2.5 w-2.5" /> : null}
  </span>
);

export type QueueItemContentProps = ComponentProps<"span"> & {
  completed?: boolean;
};

export const QueueItemContent = ({
  completed = false,
  className,
  children,
  ...props
}: QueueItemContentProps) => (
  <span
    className={cx(
      "min-w-0 flex-1 truncate text-xs",
      completed ? "text-muted-foreground line-through" : "text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export type QueueItemActionsProps = ComponentProps<"div">;

export const QueueItemActions = ({ className, children, ...props }: QueueItemActionsProps) => (
  <div className={cx("flex flex-shrink-0 items-center gap-0.5", className)} {...props}>
    {children}
  </div>
);

export type QueueItemActionProps = ComponentProps<"button">;

export const QueueItemAction = ({ className, children, ...props }: QueueItemActionProps) => (
  <button
    type="button"
    className={cx(
      "grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export type QueueItemBadgeProps = ComponentProps<"span">;

// A trailing badge for an item, used to mark a queued plan step that changes state.
export const QueueItemBadge = ({ className, children, ...props }: QueueItemBadgeProps) => (
  <span
    className={cx(
      "flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
