/** Browser WebSocket auth for Grok Voice ephemeral tokens. */
export function getXaiWebSocketSubprotocol(clientSecret: string): string {
  const trimmed = clientSecret.trim();
  if (trimmed.startsWith("xai-client-secret.")) return trimmed;
  return `xai-client-secret.${trimmed}`;
}
