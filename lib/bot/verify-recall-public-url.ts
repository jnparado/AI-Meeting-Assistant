import { getRecallPublicAppUrl } from "@/lib/bot/recall-config";
import {
  getRecallVoiceAgentSetupHint,
  isRecallVoiceAgentEnabled,
  isRecallVoiceAgentUrlConfigured,
} from "@/lib/bot/recall-voice-agent";

export async function assertRecallPublicAppUrlReachable(): Promise<void> {
  if (!isRecallVoiceAgentEnabled()) return;

  if (!isRecallVoiceAgentUrlConfigured()) {
    throw new Error(
      "Voice agent needs a public HTTPS URL. " + getRecallVoiceAgentSetupHint(),
    );
  }

  const base = getRecallPublicAppUrl().replace(/\/$/, "");
  const probeUrl = `${base}/bot-agent`;

  try {
    const res = await fetch(probeUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      throw new Error(
        `Voice agent page returned ${res.status}. Run npm run recall:tunnel, restart dev, then send a new bot.`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Voice agent page")) {
      throw err;
    }
    throw new Error(
      "RECALL_PUBLIC_APP_URL is offline (tunnel expired?). Run npm run recall:tunnel, keep it running, restart npm run dev, then leave the meeting and send the bot again. " +
        getRecallVoiceAgentSetupHint(),
    );
  }
}
