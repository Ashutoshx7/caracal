/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the sign-up route.
*/
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Button, Field } from "@/components/ui";
import { signUp } from "@/platform/auth";
import { hasSession } from "@/platform/auth/guards";
import { content } from "@/platform/content/resolver";

export const Route = createFileRoute("/sign-up")({
  beforeLoad: async () => {
    if (await hasSession()) throw redirect({ to: "/app" });
  },
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const t = content.auth;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create account.");
      return;
    }
    navigate({ to: "/onboarding" });
  }

  return (
    <AuthLayout
      title={t.signUpTitle}
      subtitle={t.signUpSubtitle}
      footer={
        <Link to="/sign-in" className="hover:text-foreground">
          {t.toSignIn}
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <SocialButtons callbackURL={`${window.location.origin}/app`} />
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={t.nameLabel}
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label={t.emailLabel}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label={t.passwordLabel}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Creating account…" : t.signUpCta}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
