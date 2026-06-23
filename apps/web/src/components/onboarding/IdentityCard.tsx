/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders a flippable live Caracal account identity card previewing onboarding profile data.
*/
import { useRef, useState, type ReactNode } from "react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function FlipHint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 0 1 15-6.7L21 7" />
        <path d="M21 3v4h-4" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 17" />
        <path d="M3 21v-4h4" />
      </svg>
      {label}
    </span>
  );
}

function Fingerprint({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      className={className}
    >
      <path d="M60 18c23 0 42 18 42 42 0 9-1 17-3 24" />
      <path d="M60 30c17 0 30 13 30 30 0 11-2 21-6 30" />
      <path d="M60 42c10 0 18 8 18 18 0 14-3 27-9 38" />
      <path d="M60 54c4 0 6 3 6 6 0 17-4 33-12 47" />
      <path d="M48 26c-15 6-26 21-26 38 0 8 1 15 3 22" />
      <path d="M36 36c-9 7-14 18-14 30 0 7 1 13 2 19" />
      <path d="M60 66c-1 14-5 28-12 40" />
      <path d="M22 70c2 12 1 24-3 36" />
    </svg>
  );
}

/** Shared decorative background used by both faces so the card looks uniform when flipped. */
function CardBackdrop({ gx, gy, active }: { gx: number; gy: number; active: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(140deg, #1A1526 0%, #141019 52%, #0C0A11 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 110% at 100% 0%, rgba(108,63,245,0.28), transparent 60%)",
        }}
      />
      <Fingerprint className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-white/[0.07]" />
      <Fingerprint className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rotate-180 text-white/[0.05]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(240px circle at ${gx}% ${gy}%, rgba(255,255,255,0.16), transparent 60%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/18 to-transparent" />
      </div>
    </>
  );
}

function Face({ side, children }: { side: "front" | "back"; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[20px]"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: side === "back" ? "rotateY(180deg)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Detail({
  label,
  value,
  align = "left",
  mono = false,
}: {
  label: string;
  value: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-medium text-white/90 ${mono ? "font-mono tracking-[0.12em]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function IdentityCard({
  accountId,
  fullName,
  displayName,
  email,
  avatar,
}: {
  accountId: string;
  fullName: string;
  displayName: string;
  email: string;
  avatar: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 30, active: false });
  const [flipped, setFlipped] = useState(false);

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      ry: (px - 0.5) * 14,
      rx: -(py - 0.5) * 12,
      gx: px * 100,
      gy: py * 100,
      active: true,
    });
  }
  function onLeave() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 30, active: false });
  }

  const name = fullName.trim() || "Your name";
  const handle = displayName.trim();
  const initials = initialsOf(fullName || displayName) || "C";
  const issued = new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <div style={{ perspective: 1300 }} className="flex justify-center">
      <button
        ref={ref}
        type="button"
        aria-pressed={flipped}
        aria-label={flipped ? "Show front of identity card" : "Show back of identity card"}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={() => setFlipped((value) => !value)}
        className="animate-card-in relative w-full max-w-[440px] cursor-pointer rounded-[20px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#9D7BF4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ aspectRatio: "1.586 / 1", perspective: 1300 }}
      >
        <div
          className="relative h-full w-full rounded-[20px] text-white shadow-2xl"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt.rx}deg) rotateY(${flipped ? 180 + tilt.ry : tilt.ry}deg)`,
            transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: tilt.active
              ? "0 30px 60px -20px rgba(108,63,245,0.45)"
              : "0 20px 45px -22px rgba(0,0,0,0.7)",
          }}
        >
          {/* FRONT */}
          <Face side="front">
            <div className="absolute inset-0" style={{ backgroundColor: "#0E0B14" }}>
              <CardBackdrop gx={tilt.gx} gy={tilt.gy} active={tilt.active && !flipped} />
            </div>
            <div className="relative flex h-full flex-col justify-between p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/caracal_sq.png"
                    alt="Caracal"
                    className="h-9 w-9 object-contain"
                    width={36}
                    height={36}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
                    Identity
                  </span>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Community
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/5 text-lg font-semibold text-white/85">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold tracking-tight">{name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-white/55">
                    {handle ? `@${handle}` : "@handle"}
                  </p>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <Detail label="Account ID" value={accountId} mono />
                <FlipHint label="Tap for details" />
              </div>
            </div>
          </Face>

          {/* BACK */}
          <Face side="back">
            <div className="absolute inset-0" style={{ backgroundColor: "#0E0B14" }}>
              <CardBackdrop gx={tilt.gx} gy={tilt.gy} active={tilt.active && flipped} />
            </div>
            <div className="relative flex h-full flex-col p-6">
              {/* Magnetic stripe */}
              <div className="-mx-6 mt-1 h-9 bg-black/45" />

              {/* Detail grid */}
              <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-4">
                <Detail label="Email" value={email || "owner@caracal.local"} mono />
                {/*
                  Community Edition has no organization concept: all zones link directly to the
                  account, so this always reads "N/A". The Organization field is reserved for the
                  Enterprise Edition, where it is populated from the tenant. Do not allow users to
                  set this in Community Edition.
                */}
                <Detail label="Organization" value="N/A" align="right" />
                <Detail label="Issued" value={issued} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
                  <LockIcon />
                  {accountId}
                </span>
                <FlipHint label="Tap to flip" />
              </div>
            </div>
          </Face>
        </div>
      </button>
    </div>
  );
}
