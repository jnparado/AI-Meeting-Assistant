import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "@/components/auth-form";
import { SupabaseAuthStatus } from "@/components/supabase-auth-status";

export default async function SignupPage() {
  const config = getPublicSupabaseConfig();

  if (config.configured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect("/dashboard/meetings");
      }
    } catch {
      // show signup form
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <SupabaseAuthStatus configured={config.configured} projectUrl={config.url} />
      <AuthForm mode="signup" />
    </div>
  );
}
