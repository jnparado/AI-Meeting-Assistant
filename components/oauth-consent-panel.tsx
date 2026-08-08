import { Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  authorizationId: string;
  clientName: string;
  redirectUri: string;
  scope?: string;
  userEmail?: string | null;
};

export function OAuthConsentPanel({
  authorizationId,
  clientName,
  redirectUri,
  scope,
  userEmail,
}: Props) {
  const scopes =
    scope
      ?.split(" ")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return (
    <Card className="glass-panel w-full rounded-3xl">
      <CardHeader className="text-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Shield className="size-6" aria-hidden />
        </span>
        <CardTitle className="text-xl">Authorize application</CardTitle>
        <CardDescription>
          <strong className="text-foreground">{clientName}</strong> wants to access
          your MeetMind account
          {userEmail ? (
            <>
              {" "}
              as <span className="text-foreground">{userEmail}</span>
            </>
          ) : null}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-sm">
          <p className="flex items-start gap-2 text-muted-foreground">
            <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="break-all">
              After you approve, you will be sent back to:{" "}
              <span className="font-medium text-foreground">{redirectUri}</span>
            </span>
          </p>
        </div>

        {scopes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Requested permissions</p>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {scopes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <form
          action="/api/oauth/decision"
          method="POST"
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <Button
            type="submit"
            name="decision"
            value="approve"
            className="flex-1"
          >
            Allow access
          </Button>
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="outline"
            className="flex-1"
          >
            Deny
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
