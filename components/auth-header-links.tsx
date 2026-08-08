import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { authPathWithNext } from "@/lib/auth/safe-next";
import { cn } from "@/lib/utils";

type AuthHeaderLinksProps = {
  active: "login" | "signup";
  next?: string;
};

export function AuthHeaderLinks({ active, next }: AuthHeaderLinksProps) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={authPathWithNext("/login", next)}
        className={cn(
          buttonVariants({
            variant: active === "login" ? "secondary" : "ghost",
            size: "sm",
          }),
        )}
        aria-current={active === "login" ? "page" : undefined}
      >
        Sign in
      </Link>
      <Link
        href={authPathWithNext("/signup", next)}
        className={cn(
          buttonVariants({
            variant: active === "signup" ? "default" : "outline",
            size: "sm",
          }),
          "rounded-full px-4",
        )}
        aria-current={active === "signup" ? "page" : undefined}
      >
        Create account
      </Link>
    </div>
  );
}
