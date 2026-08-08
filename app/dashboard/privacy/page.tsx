import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/privacy");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy center</h1>
        <p className="text-muted-foreground">
          How MeetMind handles your account, calendar, and meeting data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we store</CardTitle>
          <CardDescription className="space-y-3 leading-relaxed text-foreground/80">
            <p>
              Your sign-in email and profile name are stored in Supabase Auth and
              your workspace profile. Calendar OAuth tokens are stored encrypted
              server-side and used only to read upcoming events and meeting links.
            </p>
            <p>
              When an AI assistant joins a meeting, transcripts and summaries are
              saved to your workspace so you can review them in Meetings.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your controls</CardTitle>
          <CardDescription className="leading-relaxed text-foreground/80">
            Disconnect calendars anytime from Calendar settings. Turn off follow-up
            channels and notification email in{" "}
            <Link
              href="/dashboard/settings"
              className="text-primary underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            . Sign out to end your session on this device.
          </CardDescription>
        </CardHeader>
      </Card>

      <Link href="/dashboard/settings" className={cn(buttonVariants({ variant: "outline" }))}>
        Open settings
      </Link>
    </div>
  );
}
