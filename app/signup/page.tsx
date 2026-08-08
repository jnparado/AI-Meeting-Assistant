import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/safe-next";
import { AuthPageLayout } from "@/components/auth-page-layout";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your MeetMind workspace — join meetings with AI.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>;
}) {
  const params = await searchParams;
  const afterSignup = safeNextPath(params.next);
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
      // show signup form
    }
  }

  return (
    <AuthPageLayout
      mode="signup"
      title="Create your workspace"
      description="Free to start — connect calendar and join meetings with AI."
      redirectAfter={afterSignup}
      supabaseConfigured={config.configured}
      supabaseProjectUrl={config.url}
      signedInEmail={signedInEmail}
      message={params.message ?? null}
    />
  );
}
