"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthRedirectUrl } from "@/lib/supabase/config";
import { ensureUserWorkspace } from "@/lib/org/ensure-workspace";
import { cookies } from "next/headers";
import { ORG_COOKIE } from "@/lib/org/server";

export type AuthActionState = {
  error?: string;
  success?: string;
  needsEmailConfirmation?: boolean;
};

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();

  if (!email || !password || !fullName || !organizationName) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const redirectTo = `${getAuthRedirectUrl("/auth/callback")}?next=${encodeURIComponent("/dashboard/meetings")}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: fullName,
        organization_name: organizationName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session || !data.user) {
    return {
      success: "Account created. Check your email to confirm, then sign in.",
      needsEmailConfirmation: true,
    };
  }

  await bootstrapWorkspace(data.user.id, data.user.email, {
    full_name: fullName,
    organization_name: organizationName,
  });

  redirect("/dashboard/meetings");
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Sign in failed. Please try again." };
  }

  const meta = data.user.user_metadata as {
    full_name?: string;
    organization_name?: string;
  };

  await bootstrapWorkspace(data.user.id, data.user.email, {
    full_name: meta.full_name,
    organization_name: meta.organization_name,
  });

  const next = String(formData.get("next") ?? "").trim();
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/meetings";
  redirect(safeNext);
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const redirectTo = `${getAuthRedirectUrl("/auth/callback")}?next=/login`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: "If an account exists for that email, a reset link was sent.",
  };
}

async function bootstrapWorkspace(
  userId: string,
  email: string | undefined,
  meta: { full_name?: string; organization_name?: string },
) {
  const workspace = await ensureUserWorkspace(userId, email, meta);
  if (!workspace?.organizationId) return;

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, workspace.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
