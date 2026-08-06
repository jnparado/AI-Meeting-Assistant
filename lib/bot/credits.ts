import { createServiceClient } from "@/lib/supabase/server";

export class SubscriptionError extends Error {
  code: "inactive" | "no_credits";

  constructor(message: string, code: "inactive" | "no_credits") {
    super(message);
    this.code = code;
  }
}

export async function ensureSubscriptionReady(organizationId: string) {
  const supabase = createServiceClient();
  await supabase.from("subscriptions").upsert(
    {
      organization_id: organizationId,
      status: "active",
      plan: "free",
      meeting_credits_included: 100,
      meeting_credits_used: 0,
    },
    { onConflict: "organization_id" },
  );
}

export async function assertSubscriptionAndCredits(
  organizationId: string,
  options?: { autoFix?: boolean },
) {
  const autoFix = options?.autoFix ?? process.env.NODE_ENV === "development";
  const supabase = createServiceClient();

  if (autoFix) {
    await ensureSubscriptionReady(organizationId);
  }

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
  const status = String(subscription.status ?? "")
    .toLowerCase()
    .trim();

  if (!activeStatuses.has(status)) {
    if (autoFix) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          meeting_credits_included: Math.max(
            subscription.meeting_credits_included ?? 0,
            100,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId);
    } else {
      throw new SubscriptionError(
        "Subscription is not active. Upgrade to schedule AI assistants.",
        "inactive",
      );
    }
  }

  const included =
    subscription.meeting_credits_included ?? (autoFix ? 100 : 0);
  const used = subscription.meeting_credits_used ?? 0;

  if (included > 0 && used >= included) {
    if (autoFix) {
      await supabase
        .from("subscriptions")
        .update({
          meeting_credits_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId);
    } else {
      throw new SubscriptionError(
        "No meeting credits remaining this billing period",
        "no_credits",
      );
    }
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
