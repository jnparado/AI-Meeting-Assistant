"use client";

import { useState } from "react";
import Link from "next/link";
import { OAuthButtons } from "@/components/oauth-buttons";
import { EmailSignInForm } from "@/components/email-sign-in-form";
import { EmailSignUpForm } from "@/components/email-sign-up-form";
import { resetPasswordAction, type AuthActionState } from "@/lib/auth/actions";
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

const initialState: AuthActionState = {};

type AuthFormProps = {
  mode: "login" | "signup";
  callbackError?: string | null;
  redirectAfter?: string;
  supabaseConfigured: boolean;
};

export function AuthForm({
  mode,
  callbackError,
  redirectAfter,
  supabaseConfigured,
}: AuthFormProps) {
  const [showReset, setShowReset] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  const error = resetState.error ?? callbackError ?? null;
  const success = resetState.success ?? null;

  if (showReset && mode === "login") {
    return (
      <Card className="glass-panel w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
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
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-primary" role="status">
                {success}
              </p>
            )}
            <Button type="submit" disabled={resetPending} className="w-full">
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
    <Card className="glass-panel w-full max-w-md rounded-2xl">
      <CardHeader>
        <CardTitle>{mode === "signup" ? "Create account" : "Sign in"}</CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "Create your workspace — powered by Supabase Auth."
            : "Use Google or your email and password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <OAuthButtons
          mode={mode}
          redirectAfter={redirectAfter}
          supabaseConfigured={supabaseConfigured}
        />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or email</span>
          </div>
        </div>
        {mode === "signup" ? (
          <EmailSignUpForm supabaseConfigured={supabaseConfigured} />
        ) : (
          <>
            <EmailSignInForm
              redirectAfter={redirectAfter}
              supabaseConfigured={supabaseConfigured}
            />
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowReset(true)}
            >
              Forgot password?
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
