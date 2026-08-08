import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?next=/dashboard/profile");
  }

  const meta = user.user_metadata as { full_name?: string };
  const fullName = meta.full_name?.trim() ?? "";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">
          Your account details and how you appear in MeetMind.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Update your display name for the header menu.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm email={user.email} initialFullName={fullName} />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        To change your password, use{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>{" "}
        and choose forgot password, or manage credentials in your identity provider
        (Google / Apple).
      </p>

      <Link href="/dashboard/settings" className={cn(buttonVariants({ variant: "outline" }))}>
        Workspace settings
      </Link>
    </div>
  );
}
