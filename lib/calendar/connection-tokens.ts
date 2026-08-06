import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";

export type CalendarConnectionRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
};

export function getPlainAccessToken(connection: CalendarConnectionRow): string {
  return decryptSecret(connection.access_token);
}

export function getPlainRefreshToken(
  connection: CalendarConnectionRow,
): string | null {
  if (!connection.refresh_token) return null;
  return decryptSecret(connection.refresh_token);
}

export function encryptedTokens(input: {
  accessToken: string;
  refreshToken?: string | null;
}) {
  return {
    access_token: encryptSecret(input.accessToken),
    refresh_token: input.refreshToken ? encryptSecret(input.refreshToken) : null,
  };
}
