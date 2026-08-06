import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SimpleAiJoin } from "@/components/simple-ai-join";
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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between px-4 py-4">
        <span className="font-semibold">MeetMind</span>
        <Link href="/dashboard/meetings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Meetings
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-4">
        <SimpleAiJoin initialUrl={params.url ?? ""} />
      </main>
    </div>
  );
}
