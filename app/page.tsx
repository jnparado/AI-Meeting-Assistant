import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <span className="text-lg font-semibold">MeetMind</span>
        <div className="flex gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-4 pb-20 pt-8">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-primary">Meeting intelligence</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Send an AI assistant to every important call
          </h1>
          <p className="text-lg text-muted-foreground">
            Connect your calendar, pick a meeting, and let a bot join Google Meet,
            Zoom, or Teams — record, transcribe, summarize, and follow up
            automatically.
          </p>
          <Link href="/join" className={cn(buttonVariants({ size: "lg" }))}>
            Join a meeting with AI
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Sign up free
          </Link>
        </div>
        <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Connect Google or Microsoft Calendar",
            "Import upcoming meetings",
            "Enable Send AI Assistant per meeting",
            "Bot joins and announces recording",
            "AI summary, decisions & action items",
            "Follow-up via email, Slack, or CRM",
          ].map((step) => (
            <li
              key={step}
              className="rounded-lg border border-border/60 bg-card px-4 py-3"
            >
              {step}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
