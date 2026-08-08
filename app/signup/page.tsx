import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "@/components/auth-form";
import { SupabaseAuthStatus } from "@/components/supabase-auth-status";
import { GoogleOAuthSetupHelp } from "@/components/google-oauth-setup-help";
import { MarketingShell } from "@/components/marketing-shell";

export default async function SignupPage() {
  const config = getPublicSupabaseConfig();

  if (config.configured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect("/join");
      }
    } catch {
      // show signup form
    }
  }

  return (
    <MarketingShell showAuthLinks={false}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-20 pt-4 md:pt-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Free to start — connect calendar and join meetings with AI.
          </p>
        </div>
        <SupabaseAuthStatus configured={config.configured} projectUrl={config.url} />
        <AuthForm mode="signup" supabaseConfigured={config.configured} />
        <GoogleOAuthSetupHelp />
      </main>
    </MarketingShell>
  );
}
