import { createServiceClient } from "@/lib/supabase/server";

function slugify(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "workspace"}-${userId.slice(0, 8)}`;
}

export async function ensureUserWorkspace(
  userId: string,
  email: string | undefined,
  meta: { full_name?: string; organization_name?: string },
): Promise<{ organizationId: string } | null> {
  const supabase = createServiceClient();

  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingMember?.organization_id) {
    await supabase
      .from("profiles")
      .update({ default_organization_id: existingMember.organization_id })
      .eq("id", userId);

    return { organizationId: existingMember.organization_id };
  }

  const orgName =
    meta.organization_name?.trim() ||
    (email ? email.split("@")[1] : null) ||
    "My company";

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug: slugify(orgName, userId),
    })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("ensureUserWorkspace: org insert failed", orgError?.message);
    return null;
  }

  await supabase.from("profiles").upsert({
    id: userId,
    full_name: meta.full_name ?? "",
    default_organization_id: org.id,
  });

  await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  await supabase.from("subscriptions").upsert(
    {
      organization_id: org.id,
      status: "trialing",
      plan: "free",
      meeting_credits_included: 100,
      meeting_credits_used: 0,
    },
    { onConflict: "organization_id" },
  );

  await supabase.from("organization_integrations").upsert(
    {
      organization_id: org.id,
      notification_email: email ?? null,
    },
    { onConflict: "organization_id" },
  );

  await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      notification_email: email ?? null,
    },
    { onConflict: "user_id" },
  );

  return { organizationId: org.id };
}

export async function ensureUserWorkspaceFromSession() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata as {
    full_name?: string;
    organization_name?: string;
  };

  return await ensureUserWorkspace(user.id, user.email, {
    full_name: meta.full_name,
    organization_name: meta.organization_name,
  });
}
