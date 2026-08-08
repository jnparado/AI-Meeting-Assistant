import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/safe-next";
import { AuthPageLayout } from "@/components/auth-page-layout";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to MeetMind and send your AI to live meetings.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
    redirect?: string;
  }>;
}) {
  const params = await searchParams;
  const afterLogin = safeNextPath(params.next ?? params.redirect);
  const config = getPublicSupabaseConfig();

  let signedInEmail: string | null = null;
  if (config.configured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedInEmail = user?.email ?? null;
    } catch {
      // show login form
    }
  }

  const callbackError =
    params.error === "auth"
      ? "Authentication failed. Try again or use email sign-in."
      : null;

  return (
    <AuthPageLayout
      mode="login"
      title="Welcome back"
      description="Sign in to send your AI to a live meeting."
      redirectAfter={afterLogin}
      supabaseConfigured={config.configured}
      supabaseProjectUrl={config.url}
      signedInEmail={signedInEmail}
      callbackError={callbackError}
      message={params.message ?? null}
    />
  );
}
