import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardNavLinks } from "@/components/dashboard-nav-links";
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
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/meetings"
            className="font-semibold tracking-tight hover:opacity-80"
          >
            <span className="text-gradient">MeetMind</span>
          </Link>
          {activeOrg && organizations.length > 0 && (
            <OrgSwitcher
              organizations={organizations}
              activeOrganizationId={activeOrg.id}
            />
          )}
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <DashboardNavLinks />
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
