import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingShellProps = {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  showAuthLinks?: boolean;
};

export function MarketingShell({
  children,
  headerRight,
  showAuthLinks = true,
}: MarketingShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-app-gradient" aria-hidden />
      <div
        className="pointer-events-none absolute -left-32 top-20 size-[28rem] rounded-full bg-primary/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 size-[24rem] rounded-full bg-violet-400/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.5_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0_0/0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <BrandLogo href="/" />
        {headerRight ??
          (showAuthLinks ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign in
              </Link>
              <Link href="/join" className={cn(buttonVariants({ size: "sm" }))}>
                Join with AI
              </Link>
            </div>
          ) : null)}
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
