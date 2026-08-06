import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

const ORG_COOKIE = "active_organization_id";

export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug)")
    .eq("user_id", userId);

  if (error) {
    console.error("getUserOrganizations:", error.message);
  }

  const fromJoin =
    data
      ?.map((row) => {
        const org = row.organizations as Organization | Organization[] | null;
        if (Array.isArray(org)) return org[0] ?? null;
        return org;
      })
      .filter((org): org is Organization => Boolean(org)) ?? [];

  if (fromJoin.length) return fromJoin;

  const orgIds =
    data?.map((row) => row.organization_id).filter(Boolean) ?? [];
  if (!orgIds.length) return [];

  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .in("id", orgIds);

  if (orgError) {
    console.error("getUserOrganizations org fetch:", orgError.message);
    return [];
  }

  return orgRows ?? [];
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

  const supabase = createServiceClient();
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
