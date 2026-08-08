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
    .select("id, external_bot_id")
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
    .in("status", [
      "scheduled",
      "joining",
      "waiting_room",
      "joined",
      "recording",
    ]);

  for (const bot of activeBots ?? []) {
    if (bot.external_bot_id) {
      try {
        await cancelRecallBot(bot.external_bot_id);
      } catch (err) {
        console.error("cancelRecallBot failed:", err);
      }
    }
  }

  await supabase
    .from("meeting_bots")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
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
