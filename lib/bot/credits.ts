import { createServiceClient } from "@/lib/supabase/server";

export class SubscriptionError extends Error {
  code: "inactive" | "no_credits";

  constructor(message: string, code: "inactive" | "no_credits") {
    super(message);
    this.code = code;
  }
}

export async function assertSubscriptionAndCredits(organizationId: string) {
  const supabase = createServiceClient();
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("status, meeting_credits_included, meeting_credits_used, plan")
    .eq("organization_id", organizationId)
    .single();

  if (error || !subscription) {
    throw new SubscriptionError(
      "No active subscription for this company",
      "inactive",
    );
  }

  const activeStatuses = new Set(["trialing", "active"]);
  if (!activeStatuses.has(subscription.status)) {
    throw new SubscriptionError(
      "Subscription is not active. Upgrade to schedule AI assistants.",
      "inactive",
    );
  }

  const included = subscription.meeting_credits_included ?? 0;
  const used = subscription.meeting_credits_used ?? 0;

  if (included > 0 && used >= included) {
    throw new SubscriptionError(
      "No meeting credits remaining this billing period",
      "no_credits",
    );
  }

  return subscription;
}

export async function consumeMeetingCredit(organizationId: string) {
  const supabase = createServiceClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("meeting_credits_used")
    .eq("organization_id", organizationId)
    .single();

  if (!subscription) return;

  await supabase
    .from("subscriptions")
    .update({
      meeting_credits_used: (subscription.meeting_credits_used ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
}
