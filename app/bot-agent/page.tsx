import { VoiceAgentClient } from "@/app/bot-agent/voice-agent-client";

type PageProps = {
  searchParams: Promise<{ token?: string; botName?: string; botId?: string }>;
};

export default async function BotAgentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token?.trim() || null;
  const botName = params.botName?.trim() || null;
  const botId = params.botId?.trim() || null;

  return (
    <main className="h-screen w-screen overflow-hidden">
      <VoiceAgentClient token={token} botName={botName} botId={botId} />
    </main>
  );
}
