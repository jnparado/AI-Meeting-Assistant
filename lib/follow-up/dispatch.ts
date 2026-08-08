import { Resend } from "resend";
import type { MeetingInsights } from "@/lib/ai/summarize-meeting";
import { createServiceClient } from "@/lib/supabase/server";

type OrgIntegrations = {
  follow_up_email: boolean;
  follow_up_slack: boolean;
  follow_up_crm: boolean;
  slack_webhook_url: string | null;
  crm_provider: string | null;
  crm_access_token: string | null;
  notification_email: string | null;
};

export async function queueFollowUpsForMeeting(
  meetingId: string,
  userId: string,
  insights: MeetingInsights,
) {
  const supabase = createServiceClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("organization_id")
    .eq("id", meetingId)
    .single();

  if (!meeting?.organization_id) return;

  const integrations = await loadOrgIntegrations(meeting.organization_id);
  if (!integrations) return;

  const channels: ("email" | "slack" | "crm")[] = [];
  if (integrations.follow_up_email) channels.push("email");
  if (integrations.follow_up_slack && integrations.slack_webhook_url) {
    channels.push("slack");
  }
  if (integrations.follow_up_crm && integrations.crm_access_token) {
    channels.push("crm");
  }

  if (channels.length === 0) return;

  await supabase.from("follow_up_jobs").insert(
    channels.map((channel) => ({
      meeting_id: meetingId,
      user_id: userId,
      channel,
      status: "pending",
      payload: insights,
    })),
  );
}

async function loadOrgIntegrations(
  organizationId: string,
): Promise<OrgIntegrations | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organization_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

export async function processPendingFollowUps(limit = 20) {
  const supabase = createServiceClient();
  const { data: jobs } = await supabase
    .from("follow_up_jobs")
    .select("*, meetings(title, organization_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!jobs?.length) return { processed: 0 };

  let processed = 0;
  for (const job of jobs) {
    try {
      const meeting = job.meetings as {
        title?: string;
        organization_id?: string;
      } | null;
      const title = meeting?.title ?? "Meeting";
      const insights = job.payload as MeetingInsights;
      const organizationId = meeting?.organization_id;

      if (!organizationId) {
        throw new Error("Meeting missing organization");
      }

      if (job.channel === "email") {
        await sendEmailFollowUp(organizationId, title, insights);
      } else if (job.channel === "slack") {
        await sendSlackFollowUp(organizationId, title, insights);
      } else if (job.channel === "crm") {
        await sendCrmFollowUp(organizationId, title, insights);
      }

      await supabase
        .from("follow_up_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (err) {
      await supabase
        .from("follow_up_jobs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", job.id);
    }
  }

  return { processed };
}

export async function processFollowUpsForMeeting(meetingId: string) {
  const supabase = createServiceClient();
  const { data: jobs } = await supabase
    .from("follow_up_jobs")
    .select("*, meetings(title, organization_id)")
    .eq("meeting_id", meetingId)
    .eq("status", "pending");

  if (!jobs?.length) return { processed: 0 };

  let processed = 0;
  for (const job of jobs) {
    try {
      const meeting = job.meetings as {
        title?: string;
        organization_id?: string;
      } | null;
      const title = meeting?.title ?? "Meeting";
      const insights = job.payload as MeetingInsights;
      const organizationId = meeting?.organization_id;

      if (!organizationId) {
        throw new Error("Meeting missing organization");
      }

      if (job.channel === "email") {
        await sendEmailFollowUp(organizationId, title, insights);
      } else if (job.channel === "slack") {
        await sendSlackFollowUp(organizationId, title, insights);
      } else if (job.channel === "crm") {
        await sendCrmFollowUp(organizationId, title, insights);
      }

      await supabase
        .from("follow_up_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (err) {
      await supabase
        .from("follow_up_jobs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", job.id);
    }
  }

  return { processed };
}

async function sendEmailFollowUp(
  organizationId: string,
  meetingTitle: string,
  insights: MeetingInsights,
) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const integration = await loadOrgIntegrations(organizationId);
  const to = integration?.notification_email;
  if (!to) throw new Error("No notification email");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const actionLines = insights.action_items
    .map((a) => `- ${a.task}${a.owner ? ` (@${a.owner})` : ""}`)
    .join("\n");

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Meetings <onboarding@resend.dev>",
    to,
    subject: `Meeting summary: ${meetingTitle}`,
    text: [
      insights.summary,
      "",
      "Decisions:",
      ...(insights.decisions.length ? insights.decisions.map((d) => `- ${d}`) : ["- None"]),
      "",
      "Action items:",
      actionLines || "- None",
    ].join("\n"),
  });
}

async function sendSlackFollowUp(
  organizationId: string,
  meetingTitle: string,
  insights: MeetingInsights,
) {
  const integration = await loadOrgIntegrations(organizationId);
  const url = integration?.slack_webhook_url;
  if (!url) throw new Error("Slack webhook not configured");

  const text = [
    `*${meetingTitle}*`,
    insights.summary,
    "",
    "*Action items*",
    ...insights.action_items.map((a) => `• ${a.task}`),
  ].join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
}

async function sendCrmFollowUp(
  organizationId: string,
  meetingTitle: string,
  insights: MeetingInsights,
) {
  const integration = await loadOrgIntegrations(organizationId);
  if (integration?.crm_provider === "hubspot" && integration.crm_access_token) {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.crm_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: `${meetingTitle}\n\n${insights.summary}`,
          hs_timestamp: Date.now(),
        },
      }),
    });
    if (!res.ok) throw new Error(`HubSpot API failed: ${res.status}`);
    return;
  }

  throw new Error("CRM not configured");
}
