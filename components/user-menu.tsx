"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import {
  CircleHelp,
  LayoutList,
  Settings,
  Shield,
  User,
} from "lucide-react";
import {
  getUserDisplayLabel,
  getUserInitials,
  getUserSubtitle,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  email: string;
  fullName?: string | null;
  className?: string;
};

const menuItems = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/meetings", label: "My meetings", icon: LayoutList },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/help", label: "Help", icon: CircleHelp },
  { href: "/dashboard/privacy", label: "Privacy center", icon: Shield },
] as const;

export function UserMenu({ email, fullName, className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = getUserInitials(email, fullName);
  const triggerLabel = getUserDisplayLabel(email, fullName);
  const subtitle = getUserSubtitle(fullName);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2 py-1.5 shadow-sm transition-colors hover:bg-muted/50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-sm font-semibold text-white"
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-foreground">
            {triggerLabel}
          </span>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm text-foreground">{email}</p>
          </div>
          <ul className="py-1">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
