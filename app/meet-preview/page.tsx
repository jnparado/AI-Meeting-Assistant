import { redirect } from "next/navigation";

export default function MeetPreviewRedirect() {
  redirect("/dashboard/meetings");
}
