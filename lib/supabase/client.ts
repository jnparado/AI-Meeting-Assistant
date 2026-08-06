import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const config = getPublicSupabaseConfig();
  if (!config.configured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  return createBrowserClient(config.url, config.anonKey);
}
