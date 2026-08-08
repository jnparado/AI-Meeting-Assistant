import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SimpleAiJoin } from "@/components/simple-ai-join";
import { MarketingShell } from "@/components/marketing-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <MarketingShell
      showAuthLinks={false}
      headerRight={
        <Link
          href="/dashboard/meetings"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          My meetings
        </Link>
      }
    >
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 pb-20 pt-6 md:pt-12">
        <SimpleAiJoin initialUrl={params.url ?? ""} />
        <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Tip: start your Meet first, then join here. Admit{" "}
          <strong className="font-medium text-foreground">MeetMind AI Notetaker</strong>{" "}
          from the lobby when prompted.
        </p>
      </main>
    </MarketingShell>
  );
}
