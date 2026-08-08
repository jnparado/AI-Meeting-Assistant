"use client";

import Link from "next/link";
import { LoginCard } from "@/components/login-card";
import { OAuthButtons } from "@/components/oauth-buttons";
import { authPathWithNext } from "@/lib/auth/safe-next";
import { EmailSignUpForm } from "@/components/email-sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthFormProps = {
  mode: "login" | "signup";
  callbackError?: string | null;
  redirectAfter?: string;
  supabaseConfigured: boolean;
};

export function AuthForm({
  mode,
  callbackError,
  redirectAfter = "/dashboard",
  supabaseConfigured,
}: AuthFormProps) {
  if (mode === "login") {
    return (
      <LoginCard
        redirectAfter={redirectAfter}
        supabaseConfigured={supabaseConfigured}
        callbackError={callbackError}
      />
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Card className="glass-panel w-full rounded-2xl">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Create your workspace — powered by Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OAuthButtons
            mode="signup"
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
          <EmailSignUpForm
            redirectAfter={redirectAfter}
            supabaseConfigured={supabaseConfigured}
          />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={authPathWithNext("/login", redirectAfter)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
