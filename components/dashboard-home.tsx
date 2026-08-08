import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Calendar, Sparkles, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const actions = [
  {
    href: "/join",
    title: "Join with AI",
    description: "Paste a Meet link and send your notetaker into a live call.",
    icon: Video,
    primary: true,
  },
  {
    href: "/dashboard/meetings",
    title: "Meetings",
    description: "Upcoming calls, summaries, and assistant settings.",
    icon: Sparkles,
  },
  {
    href: "/dashboard/connect",
    title: "Connect calendar",
    description: "Sync Google or Microsoft to schedule bots automatically.",
    icon: Calendar,
  },
  {
    href: "/dashboard/settings",
    title: "Settings",
    description: "Workspace, integrations, and preferences.",
    icon: Bot,
  },
] as const;

export async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/meetings");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {displayName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick what you want to do next — join a meeting, sync calendar, or
          review summaries.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action) => {
          const { href, title, description, icon: Icon } = action;
          const primary = "primary" in action && action.primary === true;
          return (
          <Link key={href} href={href} className="group block h-full">
            <Card
              className={cn(
                "glass-panel h-full rounded-2xl transition-shadow hover:shadow-md",
                primary && "border-primary/25 ring-1 ring-primary/10",
              )}
            >
              <CardHeader className="space-y-3">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    primary ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="mt-1.5 leading-relaxed">
                    {description}
                  </CardDescription>
                </div>
                <span
                  className={cn(
                    buttonVariants({
                      variant: primary ? "default" : "outline",
                      size: "sm",
                    }),
                    "w-fit rounded-full",
                  )}
                >
                  Open
                </span>
              </CardHeader>
            </Card>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
