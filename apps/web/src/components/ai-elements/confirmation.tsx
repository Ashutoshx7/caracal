/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Confirmation approval component family ported to the Caracal design system.
*/
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { ToolState } from "@/components/ai-elements/tool";

export interface ConfirmationApproval {
  id: string;
  approved?: boolean;
  reason?: string;
}

type ConfirmationSchema = {
  state: ToolState;
  approval: ConfirmationApproval;
};

const ConfirmationContext = createContext<ConfirmationSchema | null>(null);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation");
  }
  return context;
};

export type ConfirmationProps = ComponentProps<"div"> & {
  approval: ConfirmationApproval;
  state: ToolState;
};

// Root container for a human-in-the-loop approval. The lifecycle state and the
// recorded decision drive which of the request, accepted, or rejected slots render,
// so the surface always reflects the authoritative outcome.
export const Confirmation = ({
  approval,
  state,
  className,
  children,
  ...props
}: ConfirmationProps) => (
  <ConfirmationContext.Provider value={{ state, approval }}>
    <div className={cx("border-t border-border bg-surface px-3.5 py-2.5", className)} {...props}>
      {children}
    </div>
  </ConfirmationContext.Provider>
);

export type ConfirmationTitleProps = ComponentProps<"div">;

export const ConfirmationTitle = ({ children, className, ...props }: ConfirmationTitleProps) => (
  <div className={cx("flex items-center gap-2 text-sm", className)} {...props}>
    {children}
  </div>
);

export type ConfirmationRequestProps = ComponentProps<"span">;

export const ConfirmationRequest = ({
  children,
  className,
  ...props
}: ConfirmationRequestProps) => {
  const { state } = useConfirmation();
  if (state !== "approval-requested") return null;
  return (
    <span className={cx("text-muted-foreground", className)} {...props}>
      {children}
    </span>
  );
};

export type ConfirmationAcceptedProps = ComponentProps<"span">;

export const ConfirmationAccepted = ({
  children,
  className,
  ...props
}: ConfirmationAcceptedProps) => {
  const { approval } = useConfirmation();
  if (approval.approved !== true) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export type ConfirmationRejectedProps = ComponentProps<"span">;

export const ConfirmationRejected = ({
  children,
  className,
  ...props
}: ConfirmationRejectedProps) => {
  const { approval } = useConfirmation();
  if (approval.approved !== false) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-destructive", className)} {...props}>
      {children}
    </span>
  );
};

export type ConfirmationActionsProps = ComponentProps<"div">;

// The action row is offered only while a decision is still pending; once a response
// is recorded it disappears so an outcome cannot be re-submitted.
export const ConfirmationActions = ({
  children,
  className,
  ...props
}: ConfirmationActionsProps) => {
  const { state } = useConfirmation();
  if (state !== "approval-requested") return null;
  return (
    <div className={cx("mt-2.5 flex items-center justify-end gap-2", className)} {...props}>
      {children}
    </div>
  );
};

export type ConfirmationActionProps = Omit<ComponentProps<"button">, "type"> & {
  variant?: "default" | "outline";
};

export const ConfirmationAction = ({
  variant = "default",
  className,
  children,
  ...props
}: ConfirmationActionProps) => (
  <button
    type="button"
    className={cx(
      "inline-flex h-8 select-none items-center justify-center rounded-md px-3 text-xs font-medium outline-none transition-all",
      "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      variant === "default"
        ? "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
        : "border border-border bg-background text-foreground hover:bg-accent active:bg-accent/70",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
