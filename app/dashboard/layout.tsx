import { DashboardNav } from "@/components/dashboard-nav";
import { ensureUserWorkspaceFromSession } from "@/lib/org/ensure-workspace";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await ensureUserWorkspaceFromSession();
  } catch (error) {
    console.error("ensureUserWorkspaceFromSession failed", error);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app-gradient">
      <DashboardNav />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
