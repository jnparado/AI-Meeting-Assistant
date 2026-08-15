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

const steps = [
  {
    title: "Connect your calendar",
    body: (
      <>
        Link Google or Microsoft on the{" "}
        <Link
          href="/dashboard/connect"
          className="text-primary underline-offset-4 hover:underline"
        >
          Calendar
        </Link>{" "}
        page, then import events with video links.
      </>
    ),
  },
  {
    title: "Join a meeting with AI",
    body: (
      <>
        Use{" "}
        <Link href="/join" className="text-primary underline-offset-4 hover:underline">
          Join with AI
        </Link>{" "}
        to paste a Google Meet link, or enable the assistant on a synced meeting
        from{" "}
        <Link
          href="/dashboard/meetings"
          className="text-primary underline-offset-4 hover:underline"
        >
          Meetings
        </Link>
        .
      </>
    ),
  },
  {
    title: "Admit the notetaker",
    body: "When the bot joins, admit Adsense John from the Google Meet lobby like any guest.",
  },
  {
    title: "Review results",
    body: "After the call, open the meeting for transcript, summary, and action items. Configure follow-ups in Settings.",
  },
];

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/help");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="text-muted-foreground">
          Quick guide to using MeetMind with Google Meet and your calendar.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-base">
                {index + 1}. {step.title}
              </CardTitle>
              <CardDescription className="leading-relaxed text-foreground/80">
                {step.body}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/join" className={cn(buttonVariants())}>
          Join with AI
        </Link>
        <Link
          href="/dashboard/connect"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Connect calendar
        </Link>
      </div>
    </div>
  );
}
