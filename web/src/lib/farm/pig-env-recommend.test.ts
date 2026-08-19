/**
 * 실행: npx tsx src/lib/farm/pig-env-recommend.test.ts
 */
import assert from "node:assert/strict";
import {
  pigEnvBadgeAdvice,
  pigEnvBandForStallTy,
  pigEnvFitToBand,
  pigEnvRecommendInBand,
  pigEnvAdviceCopy,
  pigEnvFocusReadings,
  pigEnvSafetyHit,
  pigEnvTypeVerdicts,
  pigEnvVerdictForAverages,
  pigEnvVerdictOffBand,
} from "./pig-env-recommend";

{
  const preg = pigEnvBandForStallTy("SP02");
  assert.equal(preg?.stageLabel, "임신돈");
  assert.equal(preg?.tempMinC, 16);
  assert.equal(preg?.tempMaxC, 21);
  const piglet = pigEnvBandForStallTy("SP05");
  assert.equal(piglet?.tempMinC, 18);
  assert.equal(piglet?.tempMaxC, 22);
  const farrow = pigEnvBandForStallTy("SP03");
  assert.equal(farrow?.tempMinC, 18);
  assert.equal(farrow?.tempMaxC, 21);
  assert.equal(pigEnvBandForStallTy("SP10"), null);
}

{
  assert.equal(pigEnvFitToBand(18.5, 16, 21), "ok");
  assert.equal(pigEnvFitToBand(21, 16, 21), "ok");
  assert.equal(pigEnvFitToBand(24, 16, 21), "high");
  assert.equal(pigEnvFitToBand(16, 18, 22), "low");
  assert.equal(pigEnvFitToBand(null, 16, 21), "none");
  assert.equal(pigEnvRecommendInBand(24, 16, 21), 21);
  assert.equal(pigEnvRecommendInBand(16, 18, 22), 18);
  assert.equal(pigEnvRecommendInBand(20, 18, 22), 20);
}

{
  const high = pigEnvVerdictForAverages({
    stallTyCode: "SP02",
    tempAvgC: 24,
    humidityAvgPct: 61,
  });
  assert.equal(high?.stallLabel, "임신사");
  assert.equal(high?.tempFit, "high");
  assert.equal(high?.humidityFit, "high");
  assert.equal(high?.recommendTempC, 21);
  assert.equal(high?.recommendHumidityPct, 60);
  assert.equal(pigEnvVerdictOffBand(high!), true);

  const ok = pigEnvVerdictForAverages({
    stallTyCode: "SP07",
    tempAvgC: 18,
    humidityAvgPct: 50,
  });
  assert.equal(ok?.tempFit, "ok");
  assert.equal(ok?.humidityFit, "ok");
  assert.equal(pigEnvVerdictOffBand(ok!), false);

  const low = pigEnvVerdictForAverages({
    stallTyCode: "SP05",
    tempAvgC: 16,
    humidityAvgPct: 55,
  });
  assert.equal(low?.tempFit, "low");
  assert.equal(low?.recommendTempC, 18);
}

{
  const rows = pigEnvTypeVerdicts([
    {
      stallTyCode: "SP02",
      tempC: 24,
      humidityPct: 55,
    },
    {
      stallTyCode: "SP02",
      tempC: 22,
      humidityPct: 58,
    },
    {
      stallTyCode: "SP10",
      tempC: 30,
      humidityPct: 80,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.stallLabel, "임신사");
  assert.equal(rows[0]?.tempAvgC, 23);
  assert.equal(rows[0]?.tempFit, "high");
}

{
  const scoped = pigEnvFocusReadings(
    [
      { stallTyCode: "SP02", tempC: 24, humidityPct: 55 },
      { stallTyCode: "SP07", tempC: 18, humidityPct: 50 },
    ],
    "SP02",
  );
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.stallTyCode, "SP02");
}

{
  const off = pigEnvAdviceCopy(
    pigEnvTypeVerdicts([{ stallTyCode: "SP05", tempC: 16, humidityPct: 55 }]),
  );
  assert.equal(off.offBand, true);
  assert.equal(off.stallLabel, "자돈사");
  assert.match(off.summary, /자돈사/);
  assert.match(off.detail ?? "", /16도/);
  assert.match(off.detail ?? "", /목표는 18도/);
  assert.doesNotMatch(off.summary, /SP05/);
  assert.doesNotMatch(off.detail ?? "", /SP05/);

  const ok = pigEnvAdviceCopy(
    pigEnvTypeVerdicts([{ stallTyCode: "SP07", tempC: 18, humidityPct: 50 }]),
  );
  assert.equal(ok.offBand, false);
  assert.match(ok.summary, /권장 온·습도 안에/);
}

{
  assert.equal(pigEnvSafetyHit({ tempC: 36, humidityPct: 55 })?.kind, "tempHigh");
  assert.equal(pigEnvSafetyHit({ tempC: 9, humidityPct: 55 })?.kind, "tempLow");
  assert.equal(
    pigEnvSafetyHit({ tempC: 20, humidityPct: 95 })?.kind,
    "humidityHigh",
  );
  assert.equal(pigEnvSafetyHit({ tempC: 20, humidityPct: 55 }), null);
}

{
  // 통신두절이 최우선
  const offline = pigEnvBadgeAdvice(
    [
      { stallTyCode: "SP02", tempC: 36, humidityPct: 55, status: "offline" },
      { stallTyCode: "SP02", tempC: 19, humidityPct: 55, status: "normal" },
    ],
    "SP02",
  );
  assert.equal(offline.tier, "offline");
  assert.equal(offline.offBand, true);
  assert.equal(offline.noticeCount, 1);
  assert.match(offline.summary, /통신이 두절/);
  assert.match(offline.detail ?? "", /전원/);
  assert.doesNotMatch(offline.summary, /SP02/);
}

{
  // 장비 경보(안전망)가 권장표 이탈보다 우선
  const alarm = pigEnvBadgeAdvice(
    [{ stallTyCode: "SP02", tempC: 36, humidityPct: 55, status: "normal" }],
    "SP02",
  );
  assert.equal(alarm.tier, "alarm");
  assert.equal(alarm.noticeCount, 1);
  assert.equal(alarm.stallLabel, "임신사");
  assert.match(alarm.detail ?? "", /상한 35도/);
  assert.match(alarm.detail ?? "", /즉시 확인/);
}

{
  // 경보 없으면 권장표 이탈
  const off = pigEnvBadgeAdvice(
    [{ stallTyCode: "SP02", tempC: 24, humidityPct: 55, status: "normal" }],
    "SP02",
  );
  assert.equal(off.tier, "offband");
  assert.equal(off.noticeCount, 1);
  assert.match(off.detail ?? "", /목표는 21도/);

  // 모두 적정
  const ok = pigEnvBadgeAdvice(
    [{ stallTyCode: "SP07", tempC: 18, humidityPct: 50, status: "normal" }],
    "SP07",
  );
  assert.equal(ok.tier, "ok");
  assert.equal(ok.offBand, false);
  assert.equal(ok.noticeCount, 0);
}

console.log("pig-env-recommend.test.ts: ok");
