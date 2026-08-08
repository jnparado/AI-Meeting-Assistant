import { MarketingShell } from "@/components/marketing-shell";
import { AuthHeaderLinks } from "@/components/auth-header-links";
import { UserMenu } from "@/components/user-menu";
import { AuthForm } from "@/components/auth-form";
import { SupabaseAuthStatus } from "@/components/supabase-auth-status";
import { SignedInBanner } from "@/components/signed-in-banner";

type AuthPageLayoutProps = {
  mode: "login" | "signup";
  title: string;
  description: string;
  redirectAfter: string;
  supabaseConfigured: boolean;
  supabaseProjectUrl: string | null;
  signedInEmail?: string | null;
  callbackError?: string | null;
  message?: string | null;
  prefillEmail?: string;
};

export function AuthPageLayout({
  mode,
  title,
  description,
  redirectAfter,
  supabaseConfigured,
  supabaseProjectUrl,
  signedInEmail,
  callbackError,
  message,
  prefillEmail = "",
}: AuthPageLayoutProps) {
  return (
    <MarketingShell
      showAuthLinks={false}
      headerRight={
        signedInEmail ? (
          <UserMenu email={signedInEmail} />
        ) : (
          <AuthHeaderLinks active={mode} next={redirectAfter} />
        )
      }
    >
      <main className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-md flex-col justify-center gap-5 px-4 pb-16 pt-6 md:pb-20">
        {mode !== "login" ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>
          </div>
        ) : null}
        <SupabaseAuthStatus
          configured={supabaseConfigured}
          projectUrl={supabaseProjectUrl}
          showDevDetails={process.env.NODE_ENV === "development"}
        />
        {signedInEmail ? (
          <SignedInBanner email={signedInEmail} continueHref={redirectAfter} />
        ) : null}
        <AuthForm
          mode={mode}
          callbackError={callbackError}
          redirectAfter={redirectAfter}
          supabaseConfigured={supabaseConfigured}
          prefillEmail={prefillEmail}
        />
        {message && (
          <p className="text-center text-sm text-muted-foreground">{message}</p>
        )}
      </main>
    </MarketingShell>
  );
}
