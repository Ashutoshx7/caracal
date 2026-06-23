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
              {state === "done" ? (
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
              ) : (
                index + 1
              )}
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
    <div className="grid min-h-screen lg:grid-cols-[360px_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
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

      <main className="flex min-h-screen flex-col bg-background">
        <div className="border-b border-border px-6 py-3 lg:hidden">
          <span className="text-xs font-medium text-muted-foreground">
            Step {current + 1} of {steps.length} · {steps[current]?.title}
          </span>
        </div>

        <div className="flex flex-1 flex-col px-6 py-10 sm:px-10 md:px-14 lg:py-14">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <header className="mb-8 animate-fade-in">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </span>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
            </header>

            <div className="flex-1 animate-fade-in">{children}</div>

            <footer className="mt-10 flex items-center justify-between border-t border-border pt-6">
              {footer}
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
