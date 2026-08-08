"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getAppUrl } from "@/lib/env-client";

type OAuthButtonsProps = {
  mode: "login" | "signup";
  redirectAfter?: string;
};

export function OAuthButtons({ mode, redirectAfter }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "azure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "azure") {
    setLoading(provider);
    setError(null);

    try {
      const supabase = createClient();
      const next =
        redirectAfter ??
        (mode === "signup" ? "/join" : "/join");
      const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (oauthError) {
        const msg = oauthError.message.toLowerCase();
        if (msg.includes("provider") && msg.includes("not enabled")) {
          setError(
            "Google sign-in is off in Supabase. Enable it under Authentication → Providers → Google (see setup steps below).",
          );
        } else {
          setError(oauthError.message);
        }
        setLoading(null);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth unavailable");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={loading !== null}
        onClick={() => signIn("google")}
        className="w-full"
      >
        {loading === "google"
          ? "Redirecting…"
          : `${mode === "signup" ? "Sign up" : "Continue"} with Google`}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={loading !== null}
        onClick={() => signIn("azure")}
        className="w-full"
      >
        {loading === "azure"
          ? "Redirecting…"
          : `${mode === "signup" ? "Sign up" : "Continue"} with Microsoft`}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
