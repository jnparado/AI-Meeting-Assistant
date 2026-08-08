"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrgSwitcherProps = {
  organizations: { id: string; name: string }[];
  activeOrganizationId: string;
};

export function OrgSwitcher({
  organizations,
  activeOrganizationId,
}: OrgSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (organizations.length <= 1) {
    return null;
  }

  async function onChange(orgId: string) {
    setLoading(true);
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      className="hidden rounded-md border border-border bg-background px-2 py-1 text-sm md:block"
      value={activeOrganizationId}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Switch company"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
