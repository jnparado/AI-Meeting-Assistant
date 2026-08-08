import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingShell } from "@/components/marketing-shell";
import { OAuthConsentPanel } from "@/components/oauth-consent-panel";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const params = await searchParams;
  const authorizationId = params.authorization_id?.trim();

  if (!authorizationId) {
    return (
      <MarketingShell showAuthLinks={false}>
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-destructive" role="alert">
            Missing authorization_id. Open this page from an OAuth app redirect.
          </p>
        </main>
      </MarketingShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  const { data: authDetails, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error) {
    return (
      <MarketingShell showAuthLinks={false}>
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error.message}
          </p>
        </main>
      </MarketingShell>
    );
  }

  if (!authDetails) {
    return (
      <MarketingShell showAuthLinks={false}>
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-destructive" role="alert">
            Invalid authorization request.
          </p>
        </main>
      </MarketingShell>
    );
  }

  if (!("authorization_id" in authDetails) && "redirect_url" in authDetails) {
    redirect(authDetails.redirect_url as string);
  }

  const details = authDetails as {
    authorization_id: string;
    client: { name: string };
    redirect_uri: string;
    scope?: string;
  };

  return (
    <MarketingShell showAuthLinks={false}>
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-10 md:py-16">
        <OAuthConsentPanel
          authorizationId={authorizationId}
          clientName={details.client?.name ?? "Application"}
          redirectUri={details.redirect_uri}
          scope={details.scope}
          userEmail={user.email}
        />
      </main>
    </MarketingShell>
  );
}
