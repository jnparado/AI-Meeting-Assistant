import { NextResponse } from "next/server";
import { processNoShowMeetings } from "@/lib/follow-up/no-show";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processNoShowMeetings();
  return NextResponse.json(result);
}
