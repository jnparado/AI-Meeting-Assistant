"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getMeetPreviewImagePath,
  parseGoogleMeetCode,
  toGoogleMeetUrl,
} from "@/lib/meet/preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { JoinMeetNowPanel } from "@/components/join-meet-now-panel";

const DEFAULT_LINK = "https://meet.google.com/kvn-chcf-zsg";

type MeetLinkPreviewProps = {
  initialUrl?: string;
};

export function MeetLinkPreview({ initialUrl }: MeetLinkPreviewProps) {
  const start = initialUrl?.trim() || DEFAULT_LINK;
  const [input, setInput] = useState(start);
  const [submitted, setSubmitted] = useState(start);

  const code = useMemo(() => parseGoogleMeetCode(submitted), [submitted]);
  const meetUrl = code ? toGoogleMeetUrl(code) : null;
  const previewSrc = code ? getMeetPreviewImagePath(code) : null;

  function onPreview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(input);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Google Meet link preview
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Paste a Meet URL to show the lobby screen your AI assistant targets
          before joining (same flow as{" "}
          <a
            href="https://meet.google.com/kvn-chcf-zsg"
            className="text-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            meet.google.com/kvn-chcf-zsg
          </a>
          ).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting link</CardTitle>
          <CardDescription>
            Example: https://meet.google.com/kvn-chcf-zsg or code{" "}
            <code className="text-xs">kvn-chcf-zsg</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onPreview} className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="meet-url" className="sr-only">
                Google Meet URL
              </Label>
              <Input
                id="meet-url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
              />
            </div>
            <Button type="submit" className="shrink-0">
              Show preview
            </Button>
          </form>
        </CardContent>
      </Card>

      {!code && submitted.trim() && (
        <p className="text-sm text-destructive" role="alert">
          Could not read a Meet code. Use a link like meet.google.com/abc-defg-hij.
        </p>
      )}

      {code && previewSrc && meetUrl && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Meet code:{" "}
              <span className="font-medium text-foreground">{code}</span>
            </p>
            <a
              href={meetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Open in Google Meet
            </a>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <Image
              src={previewSrc}
              alt={`Google Meet lobby preview for ${code}`}
              width={1920}
              height={1080}
              className="h-auto w-full"
              priority
            />
          </div>
          <JoinMeetNowPanel initialUrl={meetUrl} />
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/dashboard/meetings" className="text-primary underline-offset-4 hover:underline">
          Back to meetings
        </Link>
      </p>
    </div>
  );
}
