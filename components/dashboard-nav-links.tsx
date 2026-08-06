"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard/meetings", label: "Meetings", match: "/dashboard/meetings" },
  { href: "/join", label: "Join with AI", match: "/join" },
  { href: "/meet-preview", label: "Meet preview", match: "/meet-preview" },
  { href: "/dashboard/connect", label: "Calendar", match: "/dashboard/connect" },
  { href: "/dashboard/settings", label: "Settings", match: "/dashboard/settings" },
];

export function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label, match }) => {
        const active =
          pathname === match ||
          pathname.startsWith(`${match}/`) ||
          (match === "/dashboard/meetings" && pathname === "/dashboard");

        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
