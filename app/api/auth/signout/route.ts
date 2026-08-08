import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim();
  await supabase.auth.signOut();
  if (email) {
    redirect(`/login?email=${encodeURIComponent(email)}`);
  }
  redirect("/login");
}
