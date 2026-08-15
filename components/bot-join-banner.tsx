"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";

type Props = {
  botName?: string | null;
};

export function BotJoinBanner({ botName }: Props) {
  const searchParams = useSearchParams();
  const justJoined =
    searchParams.get("joined") === "1" ||
    searchParams.get("joined") === "existing";
  const mode = searchParams.get("mode");
  const name =
    searchParams.get("bot")?.trim() || botName?.trim() || DEFAULT_BOT_NAME;

  if (!justJoined) return null;

  const isSimulation = mode !== "recall";

  return (
    <div
      className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-relaxed"
      role="status"
    >
      <p className="font-medium text-foreground">
        {isSimulation ? "Simulation started" : "AI bot is joining the meeting"}
      </p>
      <p className="mt-1 text-muted-foreground">
        <strong className="text-foreground">{name}</strong> is the participant in
        the call — not you. If you host the meeting, open Google Meet and admit{" "}
        <strong className="text-foreground">{name}</strong> from the waiting room.
      </p>
      {isSimulation ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
          Demo mode — no real bot on Google Meet yet. Add{" "}
          <code className="text-foreground">RECALL_API_KEY</code> to{" "}
          <code className="text-foreground">.env.local</code> and Vercel, then run{" "}
          <code className="text-foreground">npm run recall:test</code>. Get a key at{" "}
          <a
            href="https://www.recall.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            recall.ai
          </a>
          .
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          The bot should appear in the Google Meet waiting room within ~30 seconds.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Want to join the call yourself too?{" "}
        <Link
          href="#open-meet-link"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Open the conference link below
        </Link>{" "}
        in a separate tab — that is optional.
      </p>
    </div>
  );
}
