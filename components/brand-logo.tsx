import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground shadow-sm shadow-primary/25 transition group-hover:shadow-md group-hover:shadow-primary/30">
        M
      </span>
      <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
        MeetMind
      </span>
    </Link>
  );
}
