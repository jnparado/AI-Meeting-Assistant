import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserCalendars } from "@/lib/calendar/sync";
import { requireActiveOrganization } from "@/lib/org/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const organization = await requireActiveOrganization(user.id);
    const result = await syncUserCalendars(user.id, organization.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
