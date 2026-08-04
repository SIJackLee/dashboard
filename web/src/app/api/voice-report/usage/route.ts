import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { voiceReportEnabled } from "@/lib/voice-report/limits";
import { delinEnabled } from "@/lib/aria/delin-enabled";
import { getVoiceUsage } from "@/lib/voice-report/usage-store";

export async function GET() {
  if (!delinEnabled() || !voiceReportEnabled()) {
    return NextResponse.json(
      { error: "disabled" },
      { status: 503 },
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getVoiceUsage(user.id));
}
