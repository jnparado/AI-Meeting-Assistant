"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authPathWithNext, safeNextPath } from "@/lib/auth/safe-next";
import { Button } from "@/components/ui/button";
import { AuthTextField, PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Props = {
  redirectAfter?: string;
  supabaseConfigured: boolean;
};

export function EmailSignUpForm({
  redirectAfter = "/dashboard",
  supabaseConfigured,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setError("Supabase is not configured on this deployment.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const next = safeNextPath(redirectAfter);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            organization_name: organizationName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.session && data.user) {
        await fetch("/api/org/bootstrap", { method: "POST", credentials: "include" });
        router.push(next);
        router.refresh();
        return;
      }

      setSuccess("Account created. Check your email to confirm, then sign in.");
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <AuthTextField
          id="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Company name</Label>
        <AuthTextField
          id="company"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="Acme Inc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <AuthTextField
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-primary" role="status">
          {success}{" "}
          <Link
            href={authPathWithNext("/login", redirectAfter)}
            className="underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
      <Button type="submit" disabled={loading} className="h-10 w-full rounded-full">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating account…
          </>
        ) : (
          "Sign up with email"
        )}
      </Button>
    </form>
  );
}
