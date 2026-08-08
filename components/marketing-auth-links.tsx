import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Home / marketing header: Sign in + Create account */
export function MarketingAuthLinks() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        Sign in
      </Link>
      <Link
        href="/signup"
        className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")}
      >
        Create account
      </Link>
    </div>
  );
}
