import { createServiceClient } from "@/lib/supabase/server";
import { cancelRecallBot } from "@/lib/bot/recall";

export async function cancelMeetingBotForUser(
  userId: string,
  organizationId: string,
  meetingId: string,
) {
  const supabase = createServiceClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const { data: activeBots } = await supabase
    .from("meeting_bots")
    .select("id, external_bot_id, status")
    .eq("meeting_id", meetingId)
    .in("status", [
      "scheduled",
      "joining",
      "waiting_room",
      "joined",
      "recording",
    ]);

  const cancelledExternalIds = new Set<string>();

  for (const bot of activeBots ?? []) {
    const externalId = bot.external_bot_id?.trim();
    if (!externalId || cancelledExternalIds.has(externalId)) continue;
    cancelledExternalIds.add(externalId);
    try {
      await cancelRecallBot(externalId);
    } catch (err) {
      console.error("cancelRecallBot failed:", err);
    }
  }

  const { data: latestBot } = await supabase
    .from("meeting_bots")
    .select("external_bot_id, status")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestExternalId = latestBot?.external_bot_id?.trim();
  if (
    latestExternalId &&
    !cancelledExternalIds.has(latestExternalId) &&
    latestBot?.status &&
    !["completed", "failed"].includes(String(latestBot.status))
  ) {
    try {
      await cancelRecallBot(latestExternalId);
    } catch (err) {
      console.error("cancelRecallBot (latest) failed:", err);
    }
  }

  await supabase
    .from("meeting_bots")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("meeting_id", meetingId)
    .in("status", [
      "scheduled",
      "joining",
      "waiting_room",
      "joined",
      "recording",
    ]);

  await supabase
    .from("meetings")
    .update({ ai_assistant_enabled: false })
    .eq("id", meetingId);
}
