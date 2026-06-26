/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Task collapsible workflow component family ported to the Caracal design system.
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

const SearchGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChevronGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m6 9 6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type TaskSchema = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
};

const TaskCtx = createContext<TaskSchema | null>(null);

const useTask = () => {
  const ctx = useContext(TaskCtx);
  if (!ctx) {
    throw new Error("Task components must be used within Task");
  }
  return ctx;
};

export type TaskProps = Omit<ComponentProps<"div">, "children"> & {
  defaultOpen?: boolean;
  children: ReactNode;
};

// Root collapsible container. Replaces the upstream Radix Collapsible with a
// self-contained open/close controller so the component carries no UI dependency.
export const Task = ({ defaultOpen = true, className, children, ...props }: TaskProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <TaskCtx.Provider value={{ open, setOpen, contentId }}>
      <div className={cx("flex flex-col", className)} {...props}>
        {children}
      </div>
    </TaskCtx.Provider>
  );
};

export type TaskTriggerProps = Omit<ComponentProps<"button">, "title"> & {
  title: ReactNode;
};

export const TaskTrigger = ({ title, children, className, ...props }: TaskTriggerProps) => {
  const { open, setOpen, contentId } = useTask();

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => setOpen(!open)}
      className={cx(
        "group flex w-full cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <SearchGlyph className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{title}</span>
          <ChevronGlyph
            className={cx("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
        </>
      )}
    </button>
  );
};

export type TaskContentProps = ComponentProps<"div">;

export const TaskContent = ({ children, className, ...props }: TaskContentProps) => {
  const { open, contentId } = useTask();
  if (!open) return null;
  return (
    <div
      id={contentId}
      className={cx("animate-fade-in mt-3 overflow-hidden text-foreground", className)}
      {...props}
    >
      <div className="space-y-2 border-l-2 border-border pl-4">{children}</div>
    </div>
  );
};

export type TaskItemProps = ComponentProps<"div">;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cx("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </div>
);

export type TaskItemFileProps = ComponentProps<"span">;

export const TaskItemFile = ({ children, className, ...props }: TaskItemFileProps) => (
  <span
    className={cx(
      "inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
