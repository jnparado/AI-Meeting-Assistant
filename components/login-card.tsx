"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authPathWithNext, safeNextPath } from "@/lib/auth/safe-next";
import { resetPasswordAction, type AuthActionState } from "@/lib/auth/actions";
import { AuthTextField, PasswordInput } from "@/components/password-input";
import { GoogleIcon, AppleIcon } from "@/components/oauth-brand-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

const initialState: AuthActionState = {};

type LoginCardProps = {
  redirectAfter?: string;
  supabaseConfigured: boolean;
  callbackError?: string | null;
  defaultEmail?: string;
};

export function LoginCard({
  redirectAfter = "/dashboard/meetings",
  supabaseConfigured,
  callbackError,
  defaultEmail = "",
}: LoginCardProps) {
  const router = useRouter();
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  const error =
    resetState.error ?? formError ?? oauthError ?? callbackError ?? null;

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setFormError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setLoading(true);
    setFormError(null);
    setOauthError(null);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      );

      if (signInError) {
        setFormError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setFormError("Sign in failed. Check your email and password.");
        setLoading(false);
        return;
      }

      await fetch("/api/org/bootstrap", { method: "POST", credentials: "include" });
      router.push(safeNextPath(redirectAfter));
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  async function signInWithOAuth(provider: "google" | "apple") {
    if (!supabaseConfigured) {
      setOauthError("Supabase is not configured on this site.");
      return;
    }

    setOauthLoading(provider);
    setOauthError(null);
    setFormError(null);

    try {
      const supabase = createClient();
      const next = safeNextPath(redirectAfter);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (oauthErr) {
        const msg = oauthErr.message.toLowerCase();
        if (msg.includes("provider") && msg.includes("not enabled")) {
          setOauthError(
            `Enable ${provider === "google" ? "Google" : "Apple"} in Supabase → Authentication → Providers.`,
          );
        } else {
          setOauthError(oauthErr.message);
        }
        setOauthLoading(null);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "OAuth unavailable");
      setOauthLoading(null);
    }
  }

  if (showReset) {
    return (
      <Card className="glass-panel w-full max-w-md rounded-2xl border-border/80 shadow-lg">
        <CardHeader className="space-y-1 pb-2 text-center sm:text-left">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            We&apos;ll email you a link to choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={resetAction} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 rounded-xl"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {resetState.success && (
              <p className="text-sm text-primary" role="status">
                {resetState.success}
              </p>
            )}
            <Button type="submit" disabled={resetPending} className="h-11 w-full rounded-full">
              {resetPending ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowReset(false)}
            >
              Back to sign in
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel w-full max-w-md rounded-2xl border-border/80 shadow-lg">
      <CardHeader className="space-y-2 pb-0 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Log in to continue. You will be sent back automatically after signing in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
          <AuthTextField
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            leadingIcon={<Mail className="size-[1.125rem]" aria-hidden />}
          />
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            leadingIcon={<Lock className="size-[1.125rem]" aria-hidden />}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="h-11 w-full rounded-full text-base font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Logging in…
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card px-3 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading || oauthLoading !== null}
            onClick={() => signInWithOAuth("google")}
            className="h-11 w-full gap-2 rounded-full border-border bg-background text-base font-normal"
          >
            <GoogleIcon className="size-5 shrink-0" />
            {oauthLoading === "google" ? "Redirecting…" : "Sign in with Google"}
          </Button>
          <Button
            type="button"
            disabled={loading || oauthLoading !== null}
            onClick={() => signInWithOAuth("apple")}
            className="h-11 w-full gap-2 rounded-full bg-foreground text-base font-normal text-background hover:bg-foreground/90"
          >
            <AppleIcon className="size-5 shrink-0" />
            {oauthLoading === "apple" ? "Redirecting…" : "Sign in with Apple"}
          </Button>
        </div>

        <p className="pt-1 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href={authPathWithNext("/signup", redirectAfter)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
