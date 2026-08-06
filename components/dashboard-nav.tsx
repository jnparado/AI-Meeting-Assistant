import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/org-switcher";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveOrganization,
  getUserOrganizations,
} from "@/lib/org/server";

export async function DashboardNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const organizations = user ? await getUserOrganizations(user.id) : [];
  const activeOrg = user ? await getActiveOrganization(user.id) : null;

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            MeetMind
          </Link>
          {activeOrg && organizations.length > 0 && (
            <OrgSwitcher
              organizations={organizations}
              activeOrganizationId={activeOrg.id}
            />
          )}
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Meetings
          </Link>
          <Link
            href="/dashboard/connect"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Calendar
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Settings
          </Link>
          <form action="/api/auth/signout" method="post">
            <SignOutButton email={user?.email} />
          </form>
        </nav>
      </div>
    </header>
  );
}

function SignOutButton({ email }: { email?: string | null }) {
  return (
    <div className="flex items-center gap-2 pl-2">
      {email && (
        <span className="hidden text-muted-foreground lg:inline">{email}</span>
      )}
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </div>
  );
}
