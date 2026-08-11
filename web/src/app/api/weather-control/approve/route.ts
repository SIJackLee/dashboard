import { NextResponse } from "next/server";
import { approveWeatherRecommendation } from "@/lib/weather-control/approve-weather-recommendation";
import { assertWeatherCtrlRecEnabled } from "@/lib/weather-control/weather-ctrl-api-gate";

const STALE_USER_MESSAGE =
  "조건이 바뀌어 권장을 적용할 수 없습니다. 잠시 후 다시 확인해 주세요.";

/**
 * POST /api/weather-control/approve
 * body: { id: string }
 */
export async function POST(request: Request) {
  const disabled = assertWeatherCtrlRecEnabled();
  if (disabled) return disabled;
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
    const result = await approveWeatherRecommendation(id);
    if (!result.ok) {
      const status =
        result.error === "unauthorized"
          ? 401
          : result.error === "forbidden"
            ? 403
            : result.error === "not_found"
              ? 404
              : 409;
      const message =
        result.error === "stale_conditions"
          ? STALE_USER_MESSAGE
          : result.message;
      return NextResponse.json(
        { ok: false, error: result.error, message },
        { status },
      );
    }
    return NextResponse.json({ ok: true, commandId: result.commandId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "approve_failed";
    return NextResponse.json(
      { ok: false, error: "approve_failed", message },
      { status: 500 },
    );
  }
}
