import { NextResponse } from "next/server";
import { weatherCtrlRecEnabled } from "@/lib/weather-control/weather-ctrl-enabled";

/** Phase E — feature off 시 API 404 (UI gate와 동일) */
export function weatherCtrlRecDisabledResponse() {
  return NextResponse.json(
    { ok: false, error: "feature_disabled" },
    { status: 404 },
  );
}

export function assertWeatherCtrlRecEnabled(): ReturnType<
  typeof weatherCtrlRecDisabledResponse
> | null {
  if (!weatherCtrlRecEnabled()) {
    return weatherCtrlRecDisabledResponse();
  }
  return null;
}
