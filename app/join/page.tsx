import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SimpleAiJoin } from "@/components/simple-ai-join";
import { MarketingShell } from "@/components/marketing-shell";
import { HeaderUserArea } from "@/components/header-user-area";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; auto?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const meetUrl = params.url?.trim() ?? "";
  const autoJoin = params.auto !== "0" && Boolean(meetUrl);
  const loginNext = meetUrl
    ? `/join?url=${encodeURIComponent(meetUrl)}&auto=1`
    : "/join";

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }

  return (
    <MarketingShell showAuthLinks={false} headerRight={<HeaderUserArea />}>
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 pb-20 pt-6 md:pt-12">
        <SimpleAiJoin
          initialUrl={meetUrl}
          autoJoin={autoJoin}
        />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need a new meeting?{" "}
          <a
            href="/dashboard/schedule"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Schedule Google Meet &amp; send invites
          </a>
        </p>
        <p className="mt-4 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          MeetMind sends <strong className="font-medium text-foreground">{DEFAULT_BOT_NAME}</strong>{" "}
          into the call — you are not joining as yourself. If you host, admit the
          bot from the Google Meet waiting room. Summary and transcript appear on
          your{" "}
          <a href="/dashboard/meetings" className="text-primary underline-offset-4 hover:underline">
            meetings dashboard
          </a>{" "}
          after the call.
        </p>
      </main>
    </MarketingShell>
  );
}
