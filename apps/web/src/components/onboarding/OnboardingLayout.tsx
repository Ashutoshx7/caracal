/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file frames the full-page guided onboarding flow.
*/
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export interface OnboardingStep {
  title: string;
  summary: string;
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StepRail({ steps, current }: { steps: OnboardingStep[]; current: number }) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={step.title} className="flex items-start gap-3 rounded-md px-3 py-2.5">
            <span
              className={cx(
                "mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                state === "done" && "border-transparent bg-white text-[#121016]",
                state === "active" && "border-white text-white",
                state === "todo" && "border-white/25 text-white/40",
              )}
            >
              {state === "done" ? <CheckIcon /> : index + 1}
            </span>
            <span className="min-w-0">
              <span
                className={cx(
                  "block text-sm font-medium",
                  state === "todo" ? "text-white/45" : "text-white",
                )}
              >
                {step.title}
              </span>
              <span
                className={cx(
                  "mt-0.5 block text-xs",
                  state === "todo" ? "text-white/30" : "text-white/55",
                )}
              >
                {step.summary}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MobileProgress({ steps, current }: { steps: OnboardingStep[]; current: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6 lg:hidden">
      <div className="flex flex-1 items-center gap-1.5">
        {steps.map((step, index) => (
          <span
            key={step.title}
            className={cx(
              "h-1 flex-1 rounded-full transition-colors",
              index <= current ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {current + 1}/{steps.length}
      </span>
    </div>
  );
}

export function OnboardingLayout({
  steps,
  current,
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  steps: OnboardingStep[];
  current: number;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid h-screen overflow-hidden lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-8 text-white lg:flex xl:p-10"
        style={{ backgroundColor: "#121016" }}
      >
        <Link to="/" className="relative z-10 flex items-center">
          <img
            src="/caracal_dark.png"
            alt="Caracal"
            className="h-8 w-auto"
            width={140}
            height={32}
          />
        </Link>

        <div className="relative z-10 -mx-3">
          <StepRail steps={steps} current={current} />
        </div>

        <p className="relative z-10 max-w-xs text-xs leading-relaxed text-white/45">
          You own this environment. Caracal runs entirely under your control.
        </p>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: "#6C3FF5" }}
        />
      </aside>

      <main className="flex min-h-0 flex-col bg-background">
        <MobileProgress steps={steps} current={current} />

        <header className="shrink-0 border-b border-border px-5 py-5 sm:px-8 md:px-12 md:py-6">
          <div className="mx-auto w-full max-w-2xl animate-fade-in">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {title}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
          </div>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 md:px-12">
          <div key={current} className="mx-auto w-full max-w-2xl animate-fade-in">
            {children}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-8 md:px-12">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            {footer}
          </div>
        </footer>
      </main>
    </div>
  );
}
