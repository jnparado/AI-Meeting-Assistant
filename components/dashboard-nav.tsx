import Link from "next/link";
import { DashboardNavLinks } from "@/components/dashboard-nav-links";
import { OrgSwitcher } from "@/components/org-switcher";
import { UserMenu } from "@/components/user-menu";
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
  const meta = user?.user_metadata as { full_name?: string } | undefined;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/meetings"
            className="shrink-0 font-semibold tracking-tight hover:opacity-80"
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
          <div className="hidden md:contents">
            <DashboardNavLinks />
          </div>
          {user?.email ? (
            <UserMenu
              email={user.email}
              fullName={meta?.full_name ?? null}
              className="shrink-0"
            />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
