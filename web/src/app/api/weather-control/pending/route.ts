import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { parseFarmKeyId } from "@/lib/data/farm-key";
import { getPendingWeatherRecommendation } from "@/lib/data/weather-recommendation";
import { canReadFarm } from "@/lib/voice-report/build-farm-facts";
import { assertWeatherCtrlRecEnabled } from "@/lib/weather-control/weather-ctrl-api-gate";

/**
 * GET /api/weather-control/pending?farm=FARM01/P00
 * admin 또는 농장 읽기 권한 — Phase B 검수용
 */
export async function GET(request: Request) {
  const disabled = assertWeatherCtrlRecEnabled();
  if (disabled) return disabled;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const farmRaw = url.searchParams.get("farm") ?? "FARM01/P00";
  const farmKey = parseFarmKeyId(farmRaw);
  if (!farmKey) {
    return NextResponse.json({ ok: false, error: "invalid_farm" }, { status: 400 });
  }

  if (!user.isAdmin && !canReadFarm(user, farmKey)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const pending = await getPendingWeatherRecommendation(farmKey);
    return NextResponse.json({ ok: true, pending });
  } catch (e) {
    const message = e instanceof Error ? e.message : "read_failed";
    return NextResponse.json(
      { ok: false, error: "read_failed", message },
      { status: 500 },
    );
  }
}
