/** Default Recall / Google Meet participant name shown in the lobby. */
export const DEFAULT_BOT_NAME = "Adsense John";

export function getDefaultBotName(): string {
  return process.env.RECALL_DEFAULT_BOT_NAME?.trim() || DEFAULT_BOT_NAME;
}
