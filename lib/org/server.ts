import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

const ORG_COOKIE = "active_organization_id";

export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("organizations(id, name, slug)")
    .eq("user_id", userId);

  return (
    data
      ?.map((row) => {
        const org = row.organizations as Organization | Organization[] | null;
        if (Array.isArray(org)) return org[0] ?? null;
        return org;
      })
      .filter((org): org is Organization => Boolean(org)) ?? []
  );
}

export async function getActiveOrganization(userId: string): Promise<Organization | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ORG_COOKIE)?.value;
  const orgs = await getUserOrganizations(userId);
  if (!orgs.length) return null;

  if (fromCookie) {
    const match = orgs.find((o) => o.id === fromCookie);
    if (match) return match;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.default_organization_id) {
    const match = orgs.find((o) => o.id === profile.default_organization_id);
    if (match) return match;
  }

  return orgs[0] ?? null;
}

export async function requireActiveOrganization(userId: string): Promise<Organization> {
  const org = await getActiveOrganization(userId);
  if (!org) {
    throw new Error("No organization found for user");
  }
  return org;
}

export { ORG_COOKIE };
