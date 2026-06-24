/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the interactive onboarding checklist with element-anchored coachmarks for guided setup.
*/
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";
import { Button } from "./Primitives";

export type Step = {
  id: string;
  title: string;
  description?: string;
  /** CSS selector for the element this step spotlights. */
  targetSelector: string;
  completed?: boolean;
  /** Optional label for the coachmark's primary action (defaults to "Take me there"). */
  actionLabel?: string;
};

export interface InteractiveOnboardingChecklistProps {
  steps: Step[];
  open?: boolean;
  defaultOpen?: boolean;
  title?: string;
  onOpenChange?(open: boolean): void;
  onActivateStep?(id: string): void;
  onFinish?(): void;
  /**
   * When true (default), the coachmark's primary action marks the step complete locally.
   * When false, completion is driven entirely by each step's `completed` flag so the
   * checklist mirrors real backend state instead of optimistic local clicks.
   */
  manualCompletion?: boolean;
}

function usePortalTarget(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.body);
  }, []);
  return el;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(selector: string): TargetRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  // A display:none target (e.g. the sidebar on mobile) reports a zero-area rect; treat it
  // as absent so the coachmark falls back to its centered card instead of spotlighting 0,0.
  if (rect.width === 0 && rect.height === 0) return null;
  // Viewport-relative coordinates: the overlay is position:fixed, so it must not add
  // scroll offsets or the spotlight drifts when the page scrolls.
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={className}
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
    >
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M6 6l12 12M6 18 18 6" strokeLinecap="round" />
    </svg>
  );
}

const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 360;
const CARD_HEIGHT = 184;
const CARD_MARGIN = 16;
const PANEL_RESERVE_W = 340;
const PANEL_RESERVE_H = 420;

// Chooses the least-bad anchor for the coachmark card: prefer below the target, then
// above, then to the sides; never overlap the bottom-right checklist panel; finally clamp
// into the viewport so the card is always reachable even for edge-hugging targets.
function placeCard(rect: TargetRect): { top: number; left: number } {
  const { top, left, width, height } = rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates = [
    { top: top + height + CARD_MARGIN, left: left + width / 2 - CARD_WIDTH / 2 },
    { top: top - CARD_HEIGHT - CARD_MARGIN, left: left + width / 2 - CARD_WIDTH / 2 },
    { top: top + height / 2 - CARD_HEIGHT / 2, left: left + width + CARD_MARGIN },
    { top: top + height / 2 - CARD_HEIGHT / 2, left: left - CARD_WIDTH - CARD_MARGIN },
  ];

  const fit = candidates.find((pos) => {
    const fitsX = pos.left >= CARD_MARGIN && pos.left + CARD_WIDTH <= vw - CARD_MARGIN;
    const fitsY = pos.top >= CARD_MARGIN && pos.top + CARD_HEIGHT <= vh - CARD_MARGIN;
    const overlapsPanel =
      pos.left + CARD_WIDTH > vw - PANEL_RESERVE_W && pos.top + CARD_HEIGHT > vh - PANEL_RESERVE_H;
    return fitsX && fitsY && !overlapsPanel;
  });
  if (fit) return fit;

  const clampedLeft = Math.max(
    CARD_MARGIN,
    Math.min(left + width / 2 - CARD_WIDTH / 2, vw - CARD_WIDTH - CARD_MARGIN),
  );
  const clampedTop = Math.max(
    CARD_MARGIN,
    Math.min(top + height + CARD_MARGIN, vh - CARD_HEIGHT - CARD_MARGIN),
  );
  return { top: clampedTop, left: clampedLeft };
}

function CoachmarkOverlay({
  step,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  manualCompletion,
  onNext,
  onPrev,
  onPrimary,
  onClose,
}: {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  manualCompletion: boolean;
  onNext: () => void;
  onPrev: () => void;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<TargetRect | null>(() => readRect(step.targetSelector));

  const update = useCallback(() => setRect(readRect(step.targetSelector)), [step.targetSelector]);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const target = document.querySelector(step.targetSelector);
    const observer = new ResizeObserver(update);
    if (target) observer.observe(target);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [step.targetSelector, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !isLast) onNext();
      else if (e.key === "ArrowLeft" && !isFirst) onPrev();
      else if (e.key === "Enter") {
        e.preventDefault();
        onPrimary();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFirst, isLast, onNext, onPrev, onPrimary, onClose]);

  const primaryLabel = step.actionLabel ?? (manualCompletion ? "Mark complete" : "Take me there");

  if (!rect) {
    return (
      <div
        className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coachmark-title"
      >
        <div className="animate-pop-in mx-4 max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
          <h3 id="coachmark-title" className="mb-2 text-base font-semibold text-foreground">
            {step.title}
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            We couldn&apos;t find the element for this step on the current screen. Navigate to the
            relevant page, or continue.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const cx0 = rect.left + rect.width / 2;
  const cy0 = rect.top + rect.height / 2;
  const radius = Math.max(rect.width, rect.height) / 2 + SPOTLIGHT_PADDING;
  const card = placeCard(rect);

  return (
    <div
      className="animate-fade-in pointer-events-none fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachmark-title"
      style={{
        background: `radial-gradient(circle at ${cx0}px ${cy0}px, transparent ${radius}px, rgba(0,0,0,0.62) ${radius + 1}px)`,
      }}
    >
      <div
        className="absolute rounded-lg"
        style={{
          top: rect.top - SPOTLIGHT_PADDING,
          left: rect.left - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2,
          boxShadow: "0 0 0 2px var(--ring), 0 0 22px rgba(0,0,0,0.35)",
        }}
      />

      <div
        className="animate-pop-in pointer-events-auto absolute rounded-xl border border-border bg-card p-4 shadow-xl"
        style={{ top: card.top, left: card.left, width: CARD_WIDTH }}
      >
        <div className="mb-2">
          <h3 id="coachmark-title" className="text-sm font-semibold text-foreground">
            {step.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Step {stepIndex + 1} of {totalSteps}
          </p>
        </div>

        {step.description ? (
          <p className="mb-4 text-sm text-foreground">{step.description}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrev}
              disabled={isFirst}
              aria-label="Previous step"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNext}
              disabled={isLast}
              aria-label="Next step"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InteractiveOnboardingChecklist({
  steps,
  open: controlledOpen,
  defaultOpen = false,
  title = "Guided setup",
  onOpenChange,
  onActivateStep,
  onFinish,
  manualCompletion = true,
}: InteractiveOnboardingChecklistProps) {
  const portal = usePortalTarget();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  // The coachmark is spotlighted once per panel-open. Without this guard, dismissing the
  // coachmark (Escape, or a primary action that navigates away in data-driven mode) would
  // immediately re-trigger the auto-advance effect and re-dim the page the operator was
  // just sent to. Reset when the panel closes so reopening starts the tour again.
  const autoOpenedRef = useRef(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const completed = useMemo(
    () =>
      new Set<string>([
        ...steps.filter((s) => s.completed).map((s) => s.id),
        ...(manualCompletion ? [...localCompleted] : []),
      ]),
    [steps, manualCompletion, localCompleted],
  );

  const totalSteps = steps.length;
  const completedCount = steps.filter((s) => completed.has(s.id)).length;
  const progress = totalSteps === 0 ? 0 : (completedCount / totalSteps) * 100;
  const allComplete = totalSteps > 0 && completedCount === totalSteps;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) setActiveId(null);
    },
    [isControlled, onOpenChange],
  );

  // Auto-advance the coachmark to the first remaining step the first time the panel opens,
  // so the operator is immediately pointed at the next real task. After that first spotlight
  // the operator drives navigation (list clicks, prev/next), so this never re-fires and
  // re-dims the screen on dismiss.
  useEffect(() => {
    if (!open) {
      autoOpenedRef.current = false;
      return;
    }
    if (activeId || autoOpenedRef.current) return;
    const firstIncomplete = steps.find((s) => !completed.has(s.id));
    if (!firstIncomplete) return;
    const timer = setTimeout(() => {
      autoOpenedRef.current = true;
      setActiveId(firstIncomplete.id);
    }, 350);
    return () => clearTimeout(timer);
  }, [open, activeId, steps, completed]);

  // When external (data-driven) completion marks the active step done, move on.
  useEffect(() => {
    if (!activeId) return;
    if (!completed.has(activeId)) return;
    const idx = steps.findIndex((s) => s.id === activeId);
    const next = steps.slice(idx + 1).find((s) => !completed.has(s.id));
    setActiveId(next ? next.id : null);
  }, [activeId, steps, completed]);

  const activeStep = activeId ? (steps.find((s) => s.id === activeId) ?? null) : null;
  const activeIndex = activeStep ? steps.indexOf(activeStep) : -1;
  const hasPrevIncomplete =
    activeIndex > 0 && steps.slice(0, activeIndex).some((s) => !completed.has(s.id));
  const hasNextIncomplete =
    activeIndex >= 0 &&
    activeIndex < totalSteps - 1 &&
    steps.slice(activeIndex + 1).some((s) => !completed.has(s.id));

  function gotoIncomplete(from: number, dir: 1 | -1) {
    for (let i = from; i >= 0 && i < totalSteps; i += dir) {
      if (!completed.has(steps[i].id)) {
        setActiveId(steps[i].id);
        return;
      }
    }
  }

  function primaryAction(stepId: string) {
    onActivateStep?.(stepId);
    if (manualCompletion) {
      setLocalCompleted((prev) => new Set([...prev, stepId]));
      const idx = steps.findIndex((s) => s.id === stepId);
      const merged = new Set([...completed, stepId]);
      const next = steps.slice(idx + 1).find((s) => !merged.has(s.id));
      setActiveId(next ? next.id : null);
      if (steps.every((s) => merged.has(s.id))) setTimeout(() => onFinish?.(), 120);
    } else {
      // Data-driven: keep the coachmark open on this step; completion arrives via `completed`.
      setActiveId(null);
    }
  }

  if (!portal) return null;

  return createPortal(
    <>
      {open ? (
        <div
          className="animate-slide-in-right fixed bottom-4 right-4 z-[55] flex max-h-[calc(100vh-2rem)] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          role="dialog"
          aria-label={title}
        >
          <div className="border-b border-border p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Dismiss guided setup"
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {completedCount}/{totalSteps}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="scrollbar-thin flex-1 overflow-y-auto p-3">
            {steps.map((step) => {
              const isDone = completed.has(step.id);
              const isActive = activeId === step.id;
              return (
                <li key={step.id} className="mb-2 last:mb-0">
                  <button
                    onClick={() => !isDone && setActiveId(step.id)}
                    disabled={isDone}
                    className={cx(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      isDone
                        ? "cursor-default border-emerald-500/30 bg-emerald-500/10"
                        : "border-border hover:bg-accent/50",
                      isActive && !isDone ? "ring-2 ring-ring/50" : "",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0">
                        {isDone ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        ) : (
                          <CircleIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block text-sm font-medium",
                            isDone ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {step.title}
                        </span>
                        {step.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {step.description}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {allComplete ? (
            <div className="border-t border-border p-4">
              <Button
                className="w-full"
                onClick={() => {
                  onFinish?.();
                  setOpen(false);
                }}
              >
                <CheckIcon className="h-4 w-4" />
                Finish setup
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeStep ? (
        <CoachmarkOverlay
          step={activeStep}
          stepIndex={activeIndex}
          totalSteps={totalSteps}
          isFirst={!hasPrevIncomplete}
          isLast={!hasNextIncomplete}
          manualCompletion={manualCompletion}
          onNext={() => gotoIncomplete(activeIndex + 1, 1)}
          onPrev={() => gotoIncomplete(activeIndex - 1, -1)}
          onPrimary={() => primaryAction(activeStep.id)}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </>,
    portal,
  );
}
