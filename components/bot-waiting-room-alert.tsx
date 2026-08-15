import { ExternalLink } from "lucide-react";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";
import type { BotStatus } from "@/lib/types/database";

type Props = {
  meetingUrl: string;
  botName?: string | null;
  status: BotStatus;
};

export function BotWaitingRoomAlert({ meetingUrl, botName, status }: Props) {
  if (status !== "waiting_room" && status !== "joining") return null;

  const name = botName?.trim() || DEFAULT_BOT_NAME;
  const inLobby = status === "waiting_room";

  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm"
      role="alert"
    >
      <p className="font-semibold text-amber-950 dark:text-amber-50">
        {inLobby
          ? `${name} is waiting to enter your Google Meet`
          : `${name} is connecting to your Google Meet…`}
      </p>
      <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
        {inLobby ? (
          <>
            Open Google Meet → click <strong>People</strong> → under{" "}
            <strong>Waiting to join</strong>, click <strong>Admit</strong> for{" "}
            <strong>{name}</strong>. The bot leaves after 10 minutes if not
            admitted.
          </>
        ) : (
          <>The bot should reach the waiting room within ~30 seconds.</>
        )}
      </p>
      <a
        href={meetingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-8 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Open Google Meet & admit {name}
        <ExternalLink className="size-4" aria-hidden />
      </a>
    </div>
  );
}
