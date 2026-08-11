import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { dismissWeatherRecommendation } from "@/lib/data/weather-recommendation";
import { assertWeatherCtrlRecEnabled } from "@/lib/weather-control/weather-ctrl-api-gate";

/**
 * POST /api/weather-control/dismiss
 * body: { id: string }
 */
export async function POST(request: Request) {
  const disabled = assertWeatherCtrlRecEnabled();
  if (disabled) return disabled;

  const user = await getCurrentUser();  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  try {
    const result = await dismissWeatherRecommendation(id);
    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "dismiss_failed";
    return NextResponse.json(
      { ok: false, error: "dismiss_failed", message },
      { status: 500 },
    );
  }
}
