import { MeetLinkPreview } from "@/components/meet-link-preview";

export default async function MeetPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-full flex-1 bg-muted/20">
      <MeetLinkPreview initialUrl={params.url} />
    </div>
  );
}
