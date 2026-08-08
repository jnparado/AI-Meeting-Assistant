import { BrandLogo } from "@/components/brand-logo";
import { DEFAULT_AFTER_AUTH } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function BrandLogoLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <BrandLogo href={user ? DEFAULT_AFTER_AUTH : "/"} />;
}
