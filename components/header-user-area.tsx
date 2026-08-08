import { createClient } from "@/lib/supabase/server";
import { MarketingAuthLinks } from "@/components/marketing-auth-links";
import { UserMenu } from "@/components/user-menu";

export async function HeaderUserArea() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return <MarketingAuthLinks />;
  }

  const meta = user.user_metadata as { full_name?: string };
  return (
    <UserMenu email={user.email} fullName={meta.full_name ?? null} />
  );
}
