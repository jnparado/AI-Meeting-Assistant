"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthActionState,
} from "@/lib/auth/actions";
import { OAuthButtons } from "@/components/oauth-buttons";
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

const initialState: AuthActionState = {};

type AuthFormProps = {
  mode: "login" | "signup";
  callbackError?: string | null;
  redirectAfter?: string;
};

export function AuthForm({ mode, callbackError, redirectAfter }: AuthFormProps) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showReset, setShowReset] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  const error = state.error ?? resetState.error ?? callbackError ?? null;
  const success = state.success ?? resetState.success ?? null;

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
            ? "Create your company workspace with Supabase Auth."
            : "Sign in with your Supabase account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <OAuthButtons mode={mode} redirectAfter={redirectAfter} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or email</span>
          </div>
        </div>
        <form action={formAction} className="flex flex-col gap-4">
          {mode === "login" && redirectAfter ? (
            <input type="hidden" name="next" value={redirectAfter} />
          ) : null}
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="fullName"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company name</Label>
                <Input
                  id="company"
                  name="organizationName"
                  placeholder="Acme Inc."
                  required
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
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
              {success}
            </p>
          )}
          {state.needsEmailConfirmation && (
            <p className="text-sm text-muted-foreground">
              After confirming,{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                sign in here
              </Link>
              .
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Please wait…"
              : mode === "signup"
                ? "Sign up with email"
                : "Sign in with email"}
          </Button>
          {mode === "login" && (
            <button
              type="button"
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowReset(true)}
            >
              Forgot password?
            </button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
