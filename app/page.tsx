import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Video, Zap, Calendar, Bot, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingShell } from "@/components/marketing-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Video,
    title: "One link, one click",
    text: "Paste a Google Meet URL and send your AI notetaker in seconds.",
  },
  {
    icon: Bot,
    title: "Joins as a guest",
    text: "Your bot appears in the lobby — admit it like any participant.",
  },
  {
    icon: Sparkles,
    title: "Summaries & actions",
    text: "Transcripts, decisions, and follow-ups when the call ends.",
  },
];

const steps = [
  { icon: Calendar, label: "Connect calendar" },
  { icon: Zap, label: "Schedule or join now" },
  { icon: Mail, label: "Share follow-ups" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard/meetings");
  }

  return (
    <MarketingShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-24 pt-4 md:pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              AI meeting assistant
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Your AI joins the call.{" "}
              <span className="text-gradient">You stay in the conversation.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              MeetMind sends a notetaker to Google Meet, records the discussion, and
              turns it into clear summaries — without juggling tabs or manual notes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?next=/join"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Join a meeting now
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Create free account
              </Link>
            </div>
            <ul className="flex flex-wrap gap-6 pt-2 text-sm text-muted-foreground">
              {steps.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative lg:pl-4">
            <div className="glass-panel relative overflow-hidden rounded-3xl p-8 md:p-10">
              <div className="absolute -right-8 -top-8 size-40 rounded-full bg-primary/15 blur-2xl" />
              <div className="relative space-y-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Live preview
                </p>
                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/80 p-5">
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium">Product sync · Google Meet</span>
                  </div>
                  <div className="h-2 w-3/4 rounded-full bg-muted" />
                  <div className="h-2 w-1/2 rounded-full bg-muted" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                  <Bot className="size-5 text-primary" aria-hidden />
                  <div className="text-sm">
                    <p className="font-medium">MeetMind AI Notetaker</p>
                    <p className="text-muted-foreground">Waiting to be admitted…</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="glass-panel rounded-2xl p-6 transition hover:border-primary/25 hover:shadow-primary/10"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            </article>
          ))}
        </section>
      </main>
    </MarketingShell>
  );
}
