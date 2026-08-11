import assert from "node:assert/strict";
import { unpackWeatherNudge } from "@/lib/weather-control/unpack-recommendation";
import type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";

function base(over: Partial<WeatherNudgeView>): WeatherNudgeView {
  return {
    id: "test-id",
    ruleId: "wx_rise_vent",
    controllerLabel: "SP03 01번 06번",
    controllerDisplayName: "분만사 1번 6번",
    current: { setpointTemp: 24, minVentPct: 30, maxVentPct: 60 },
    proposed: { setpointTemp: 24, minVentPct: 35, maxVentPct: 70 },
    reasonKo: "외기 상승에 맞춰 환기 하한·상한을 소폭 올이는 것을 권장합니다.",
    reasonFacts: {
      externalNow: 26,
      forecastMax3h: 31,
      internalTemp: 27.2,
      rise3h: 5,
    },
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    stale: false,
    ...over,
  };
}

{
  const u = unpackWeatherNudge(base({}));
  assert.match(u.headline, /26°C.*31°C/);
  assert.match(u.contextLine ?? "", /분만사/);
  assert.match(u.contextLine ?? "", /27\.2°C/);
  assert.match(u.currentLine, /목표 24°C/);
  assert.match(u.proposedLine, /최고환기 70%/);
}

{
  const u = unpackWeatherNudge(
    base({
      ruleId: "wx_drop_heat",
      reasonFacts: { externalNow: 22, forecastMin3h: 17, drop3h: 5 },
      reasonKo: "앞으로 외기가 식을 예정이어서 목표온도를 1°C 낮추는 것을 권장합니다.",
      proposed: { setpointTemp: 23, minVentPct: 30, maxVentPct: 60 },
    }),
  );
  assert.match(u.headline, /22°C.*17°C/);
  assert.match(u.proposedLine, /목표 23°C/);
}

{
  const u = unpackWeatherNudge(
    base({
      ruleId: "wx_humid_vent",
      reasonFacts: { externalHumidity: 72, internalHumidity: 78 },
      reasonKo: "외기·축사 습도가 높아 최고환기량을 소폭 올이는 것을 권장합니다.",
    }),
  );
  assert.match(u.headline, /72%.*78%/);
}

console.log("unpack-recommendation.test.ts ok");
