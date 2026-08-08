"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Home", match: "/dashboard" },
  { href: "/dashboard/meetings", label: "Meetings", match: "/dashboard/meetings" },
  { href: "/join", label: "Join with AI", match: "/join" },
  { href: "/dashboard/connect", label: "Calendar", match: "/dashboard/connect" },
  { href: "/dashboard/settings", label: "Settings", match: "/dashboard/settings" },
];

export function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label, match }) => {
        const active =
          match === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === match || pathname.startsWith(`${match}/`);

        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
