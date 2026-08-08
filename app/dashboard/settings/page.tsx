import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import {
  CalendarConnectLinks,
  SettingsForm,
} from "@/components/settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/settings");
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) notFound();

  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("*")
    .eq("organization_id", organization.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Workspace integrations, follow-ups, and notifications
        </p>
        {params.connected && (
          <p className="mt-2 text-sm text-primary">
            Connected {params.connected} calendar successfully.
          </p>
        )}
        {params.error && (
          <p className="mt-2 text-sm text-destructive">
            Connection failed ({params.error}). Check OAuth env vars.
          </p>
        )}
      </div>
      <CalendarConnectLinks />
      <SettingsForm integrations={integrations} />
    </div>
  );
}
