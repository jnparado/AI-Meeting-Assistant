import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignedInBannerProps = {
  email: string;
  continueHref: string;
};

export function SignedInBanner({ email, continueHref }: SignedInBannerProps) {
  return (
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
      role="status"
    >
      <p>
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{email}</span>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={continueHref} className={cn(buttonVariants({ size: "sm" }))}>
          Continue to join
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Sign out
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Use the form below to sign in with a different account.
      </p>
    </div>
  );
}
