/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the password reset request route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Field } from "@/components/ui";
import { auth } from "@/platform/auth";
import { content } from "@/platform/content/resolver";

export const Route = createFileRoute("/reset")({
  component: ResetPage,
});

function ResetPage() {
  const t = content.auth;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    await auth.requestPasswordReset({ email, redirectTo: "/sign-in" }).catch(() => undefined);
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout
      title={t.resetTitle}
      subtitle={t.resetSubtitle}
      footer={
        <Link to="/sign-in" className="hover:text-foreground">
          {t.toSignIn}
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for {email}, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={t.emailLabel}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : t.resetCta}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
