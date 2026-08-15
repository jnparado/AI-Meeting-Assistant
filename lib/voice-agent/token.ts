import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string | null {
  return (
    process.env.VOICE_AGENT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.BOT_SIMULATION_SECRET?.trim() ||
    null
  );
}

export function createVoiceAgentToken(ttlMs = 6 * 60 * 60 * 1000): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", secret)
    .update(`voice-agent:${exp}`)
    .digest("hex");
  return `${exp}.${sig}`;
}

/** When no secret is configured, tokens are skipped (local dev only). */
export function verifyVoiceAgentToken(token: string | null | undefined): boolean {
  const secret = getSecret();
  if (!secret) return true;
  if (!token?.trim()) return false;

  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = createHmac("sha256", secret)
    .update(`voice-agent:${expStr}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
