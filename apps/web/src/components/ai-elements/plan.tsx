/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Plan collapsible card component family ported to the Caracal design system.
*/
import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cx } from "@/lib/cx";

const ChevronsUpDownGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m7 15 5 5 5-5M7 9l5-5 5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type PlanSchema = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  isStreaming: boolean;
};

const PlanContext = createContext<PlanSchema | null>(null);

const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("Plan components must be used within Plan");
  }
  return context;
};

export type PlanProps = Omit<ComponentProps<"div">, "children"> & {
  defaultOpen?: boolean;
  isStreaming?: boolean;
  children: ReactNode;
};

// Root collapsible card. Replaces the upstream Radix Collapsible and shadcn Card with a
// self-contained open/close controller so the component carries no UI dependency.
export const Plan = ({
  defaultOpen = true,
  isStreaming = false,
  className,
  children,
  ...props
}: PlanProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <PlanContext.Provider value={{ open, setOpen, contentId, isStreaming }}>
      <div
        className={cx(
          "flex flex-col gap-4 rounded-xl border border-border bg-card py-4 text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </PlanContext.Provider>
  );
};

export type PlanHeaderProps = ComponentProps<"div">;

export const PlanHeader = ({ className, ...props }: PlanHeaderProps) => (
  <div className={cx("flex items-start justify-between gap-3 px-4", className)} {...props} />
);

export type PlanTitleProps = Omit<ComponentProps<"div">, "children"> & {
  children: string;
};

export const PlanTitle = ({ className, children, ...props }: PlanTitleProps) => {
  const { isStreaming } = usePlan();
  return (
    <div
      className={cx(
        "text-sm font-semibold leading-none text-foreground",
        isStreaming && "animate-pulse",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export type PlanDescriptionProps = Omit<ComponentProps<"p">, "children"> & {
  children: string;
};

export const PlanDescription = ({ className, children, ...props }: PlanDescriptionProps) => {
  const { isStreaming } = usePlan();
  return (
    <p
      className={cx(
        "text-balance text-sm text-muted-foreground",
        isStreaming && "animate-pulse",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
};

export type PlanActionProps = ComponentProps<"div">;

export const PlanAction = ({ className, ...props }: PlanActionProps) => (
  <div className={cx("shrink-0", className)} {...props} />
);

export type PlanContentProps = ComponentProps<"div">;

export const PlanContent = ({ className, children, ...props }: PlanContentProps) => {
  const { open, contentId } = usePlan();
  if (!open) return null;
  return (
    <div id={contentId} className={cx("animate-fade-in px-4", className)} {...props}>
      {children}
    </div>
  );
};

export type PlanFooterProps = ComponentProps<"div">;

export const PlanFooter = ({ className, ...props }: PlanFooterProps) => (
  <div className={cx("flex items-center px-4", className)} {...props} />
);

export type PlanTriggerProps = ComponentProps<"button">;

export const PlanTrigger = ({ className, children, ...props }: PlanTriggerProps) => {
  const { open, setOpen, contentId } = usePlan();
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => setOpen(!open)}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    >
      {children ?? <ChevronsUpDownGlyph className="h-4 w-4" />}
      <span className="sr-only">Toggle plan</span>
    </button>
  );
};
