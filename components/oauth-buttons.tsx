"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthButtonsProps = {
  mode: "login" | "signup";
  redirectAfter?: string;
  supabaseConfigured: boolean;
};

export function OAuthButtons({
  mode,
  redirectAfter,
  supabaseConfigured,
}: OAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "azure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "azure") {
    if (!supabaseConfigured) {
      setError(
        "Supabase env vars are missing on this site. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    setLoading(provider);
    setError(null);

    try {
      const supabase = createClient();
      const next = redirectAfter ?? "/join";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });

      if (oauthError) {
        const msg = oauthError.message.toLowerCase();
        if (msg.includes("provider") && msg.includes("not enabled")) {
          setError(
            "Enable Google in Supabase → Authentication → Providers, and add the Supabase callback URL in Google Cloud.",
          );
        } else {
          setError(oauthError.message);
        }
        setLoading(null);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
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
        className="h-10 w-full rounded-full"
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
        className="h-10 w-full rounded-full"
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
