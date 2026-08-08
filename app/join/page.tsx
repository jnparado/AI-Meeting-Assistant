import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SimpleAiJoin } from "@/components/simple-ai-join";
import { MarketingShell } from "@/components/marketing-shell";
import { HeaderUserArea } from "@/components/header-user-area";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/join");
  }

  const params = await searchParams;

  return (
    <MarketingShell showAuthLinks={false} headerRight={<HeaderUserArea />}>
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 pb-20 pt-6 md:pt-12">
        <SimpleAiJoin initialUrl={params.url ?? ""} />
        <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Start the call, paste the link above, then admit your bot from the lobby.
          When the meeting ends you&apos;ll get a transcript, summary, and action
          items on the meeting page.
        </p>
      </main>
    </MarketingShell>
  );
}
