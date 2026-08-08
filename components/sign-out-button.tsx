"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = {
  email: string;
};

export function SignOutButton({ email }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const params = new URLSearchParams();
    if (email.trim()) {
      params.set("email", email.trim());
    }
    const query = params.toString();
    window.location.assign(query ? `/login?${query}` : "/login");
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleSignOut()}
      className="flex w-full items-center justify-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
