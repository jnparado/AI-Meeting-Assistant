import {
  getRecallVoiceAgentDisplayName,
  getRecallVoiceAgentTeamLabel,
} from "@/lib/bot/recall-voice-agent";
import { VoiceAgentClient } from "@/app/bot-agent/voice-agent-client";
import { BotAgentAvatar } from "@/components/bot-agent-avatar";

type PageProps = {
  searchParams: Promise<{ token?: string; botName?: string; botId?: string }>;
};

export default async function BotAgentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token?.trim() || null;
  const botName = params.botName?.trim() || null;
  const botId = params.botId?.trim() || null;
  const displayName = getRecallVoiceAgentDisplayName(botName ?? undefined);
  const teamLabel = getRecallVoiceAgentTeamLabel();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0" aria-hidden>
        <BotAgentAvatar alt={`${displayName} avatar`} variant="full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-16 text-center">
          <p className="text-lg font-semibold tracking-tight">{displayName}</p>
          <p className="mt-0.5 text-sm text-white/60">{teamLabel}</p>
        </div>
      </div>

      <div className="relative z-10 h-full w-full">
        <VoiceAgentClient token={token} botName={botName} botId={botId} />
      </div>
    </main>
  );
}
