import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "@/components/auth-form";
import { SupabaseAuthStatus } from "@/components/supabase-auth-status";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const afterLogin =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/join";
  const config = getPublicSupabaseConfig();

  if (config.configured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect(afterLogin);
      }
    } catch {
      // Invalid Supabase config or network error — show login form either way.
    }
  }

  const callbackError =
    params.error === "auth"
      ? "Authentication failed. Try again or use email sign-in."
      : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <SupabaseAuthStatus configured={config.configured} projectUrl={config.url} />
      <AuthForm mode="login" callbackError={callbackError} redirectAfter={afterLogin} />
      {params.message && (
        <p className="text-center text-sm text-muted-foreground">{params.message}</p>
      )}
    </div>
  );
}
