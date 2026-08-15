import OpenAI from "openai";
import { getLlmApiKey, getLlmBaseUrl, getLlmChatModel, hasLlm } from "@/lib/env";

export function hasMeetingLlm(): boolean {
  return hasLlm();
}

export function createMeetingLlmClient(): OpenAI | null {
  const apiKey = getLlmApiKey();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: getLlmBaseUrl(),
  });
}

export function getMeetingChatModel(): string {
  return getLlmChatModel();
}
