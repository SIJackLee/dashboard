/**
 * 실행: npx tsx src/lib/farm/pig-env-recommend.test.ts
 */
import assert from "node:assert/strict";
import {
  pigEnvBandForStallTy,
  pigEnvFitToBand,
  pigEnvRecommendInBand,
  pigEnvAdviceCopy,
  pigEnvFocusReadings,
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

console.log("pig-env-recommend.test.ts: ok");
