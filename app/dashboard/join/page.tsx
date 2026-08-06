import { redirect } from "next/navigation";

export default async function DashboardJoinRedirect({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  const q = params.url ? `?url=${encodeURIComponent(params.url)}` : "";
  redirect(`/join${q}`);
}
