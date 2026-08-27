/**
 * 실행: npx tsx src/lib/farm/barn-site-live.test.ts
 */
import assert from "node:assert/strict";
import {
  barnPlanCoverClimate,
  barnPlanRoomEnvChannels,
  barnPlanRoomEnvMarks,
  barnPlanRoomEnvTint,
  barnPlanRoomEnvTints,
  listLiveControllers,
  listLiveZones,
  liveCoverKeySet,
  liveZoneKeySet,
  readingForCover,
  readingsByZoneForBuilding,
  readingsForZone,
} from "./barn-site-live";
import { addEmptyBuilding, assignZoneToBuilding } from "./barn-site-prefs";
import { emptyBarnSitePrefs } from "./barn-site-types";

const preg = {
  stallTyCode: "SP02",
  stallNo: "1",
  tempC: 24,
};
const piglet = {
  stallTyCode: "SP05",
  stallNo: "2",
  tempC: 22,
};
const otherPreg = {
  stallTyCode: "SP02",
  stallNo: "3",
  tempC: 19,
};

{
  const keys = liveZoneKeySet([preg, piglet, otherPreg]);
  assert.equal(keys.has("SP02#1"), true);
  assert.equal(keys.has("SP05#2"), true);
  assert.equal(keys.has("SP02#3"), true);
}

{
  const listed = listLiveZones([
    piglet,
    preg,
    { stallTyCode: "SP02", stallNo: "1", tempC: 25 },
    { stallTyCode: "SP02", stallNo: "__ck_x", tempC: 1 },
    otherPreg,
  ]);
  assert.deepEqual(
    listed.map((z) => `${z.stallTyCode}:${z.stallNo}`),
    ["SP02:1", "SP02:3", "SP05:2"],
  );
}

{
  const listed = listLiveControllers(
    [
      { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "1" },
      { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "02" },
      { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "1" },
      { stallTyCode: "SP05", stallNo: "2", eqpmnNo: "1" },
    ],
    "SP02",
    "1",
  );
  assert.deepEqual(
    listed.map((row) => row.eqpmnNo),
    ["01", "02"],
  );
  assert.equal(liveCoverKeySet([
    { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "1" },
  ]).has("SP02#1:01"), true);
}

{
  const only = readingsForZone([preg, piglet, otherPreg], "SP02", "1");
  assert.equal(only.length, 1);
  assert.equal(only[0]?.tempC, 24);
}

{
  const rows = [
    { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "1", tempC: 19 },
    { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "02", tempC: 21 },
    { stallTyCode: "SP05", stallNo: "1", eqpmnNo: "1", tempC: 20 },
  ];
  assert.equal(readingForCover(rows, "SP02", "1", "01")?.tempC, 19);
  assert.equal(readingForCover(rows, "SP02", "1", "2")?.tempC, 21);
  assert.equal(readingForCover(rows, "SP05", "1", "1")?.tempC, 20);
  assert.equal(readingForCover(rows, "SP02", "1", "9"), undefined);
}

{
  const ok = barnPlanCoverClimate({
    stallTyCode: "SP02",
    status: "normal",
    tempC: 18,
    humidityPct: 55,
  });
  assert.equal(ok.tone, "ok");
  assert.equal(ok.tempText, "18.0");
  assert.equal(ok.humidityText, "55.0");

  const warn = barnPlanCoverClimate({
    stallTyCode: "SP02",
    status: "normal",
    tempC: 34,
    humidityPct: 55,
  });
  assert.equal(warn.tone, "warn");

  const danger = barnPlanCoverClimate({
    stallTyCode: "SP02",
    status: "normal",
    tempC: 36,
    humidityPct: 55,
  });
  assert.equal(danger.tone, "danger");

  const offline = barnPlanCoverClimate({
    stallTyCode: "SP02",
    status: "offline",
    tempC: 18,
    humidityPct: 55,
  });
  assert.equal(offline.tone, "offline");
  assert.equal(offline.tempText, null);
  assert.equal(barnPlanCoverClimate(undefined).tone, "offline");
}

{
  assert.equal(
    barnPlanRoomEnvTint({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 20.4,
      humidityPct: 62,
    }),
    "ok",
  );
  assert.equal(
    barnPlanRoomEnvTint({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 24.8,
      humidityPct: 76,
    }),
    "ok",
  );
  assert.equal(
    barnPlanRoomEnvTint(
      {
        stallTyCode: "SP05",
        status: "normal",
        tempC: 24.8,
        humidityPct: 76,
      },
      { mode: "recommend" },
    ),
    "warn",
  );
  assert.equal(
    barnPlanRoomEnvTint({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 34,
      humidityPct: 55,
    }),
    "warn",
  );
  assert.equal(
    barnPlanRoomEnvTint({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 26.4,
      humidityPct: 86,
    }),
    "warn",
  );
  assert.equal(
    barnPlanRoomEnvTint(
      {
        stallTyCode: "SP05",
        status: "normal",
        tempC: 26.4,
        humidityPct: 86,
      },
      { mode: "recommend" },
    ),
    "danger",
  );
  assert.equal(
    barnPlanRoomEnvTint({
      stallTyCode: "SP02",
      status: "offline",
      tempC: 18,
      humidityPct: 55,
    }),
    null,
  );
  const tints = barnPlanRoomEnvTints(
    [
      {
        rooms: [
          { bank: 0, index: 0 },
          { bank: 0, index: 1 },
        ],
        stallTyCode: "SP05",
        stallNo: "1",
        eqpmnNo: "03",
      },
    ],
    [
      {
        stallTyCode: "SP05",
        stallNo: "1",
        eqpmnNo: "03",
        status: "normal",
        tempC: 34,
        humidityPct: 55,
      },
    ],
  );
  assert.equal(tints["0:0"], "warn");
  assert.equal(tints["0:1"], "warn");
  assert.deepEqual(
    barnPlanRoomEnvChannels({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 20.4,
      humidityPct: 62,
    }),
    { temp: "ok", humidity: "ok" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 24.8,
      humidityPct: 76,
    }),
    { temp: "ok", humidity: "ok" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels(
      {
        stallTyCode: "SP05",
        status: "normal",
        tempC: 24.8,
        humidityPct: 76,
      },
      { mode: "recommend" },
    ),
    { temp: "warn", humidity: "ok" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 34,
      humidityPct: 55,
    }),
    { temp: "warn", humidity: "ok" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 26.4,
      humidityPct: 86,
    }),
    { temp: "ok", humidity: "warn" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels({
      stallTyCode: "SP05",
      status: "normal",
      tempC: 36,
      humidityPct: 57,
    }),
    { temp: "danger", humidity: "ok" },
  );
  const marks = barnPlanRoomEnvMarks(
    [
      {
        rooms: [{ bank: 0, index: 0 }],
        stallTyCode: "SP05",
        stallNo: "1",
        eqpmnNo: "03",
      },
    ],
    [
      {
        stallTyCode: "SP05",
        stallNo: "1",
        eqpmnNo: "03",
        status: "normal",
        tempC: 34,
        humidityPct: 55,
      },
    ],
  );
  assert.deepEqual(marks["0:0"], { temp: "warn", humidity: "ok" });
}

{
  const live = {
    stallTyCode: "SP05",
    status: "normal" as const,
    tempC: 25.8,
    humidityPct: 57,
  };
  assert.equal(barnPlanRoomEnvTint(live), "ok");
  assert.equal(barnPlanRoomEnvTint(live, { mode: "recommend" }), "warn");
  assert.equal(barnPlanRoomEnvTint(live, { mode: "alarm" }), "ok");
  assert.equal(
    barnPlanRoomEnvTint(
      { ...live, tempC: 36, humidityPct: 57 },
      { mode: "alarm" },
    ),
    "danger",
  );
  assert.deepEqual(barnPlanRoomEnvChannels(live, { mode: "alarm" }), {
    temp: "ok",
    humidity: "ok",
  });
  assert.deepEqual(
    barnPlanRoomEnvChannels(
      { ...live, tempC: 36, humidityPct: 57 },
      { mode: "alarm" },
    ),
    { temp: "danger", humidity: "ok" },
  );
  assert.deepEqual(
    barnPlanRoomEnvChannels(
      { ...live, tempC: 36, humidityPct: 91 },
      { mode: "alarm" },
    ),
    { temp: "danger", humidity: "danger" },
  );
  assert.equal(
    barnPlanRoomEnvTint(
      { ...live, tempC: 36, humidityPct: 91 },
      { mode: "alarm" },
    ),
    "danger",
  );
  assert.equal(
    barnPlanRoomEnvTint(
      { stallTyCode: "SP05", status: "normal", tempC: 24.8, humidityPct: 57 },
      {
        mode: "alarm",
        alarmSettings: {
          global: {
            tempHigh: 35,
            tempLow: 10,
            humidityHigh: 90,
            humidityLow: 30,
          },
          byStallTyCode: {
            SP05: {
              tempHigh: 22,
              tempLow: 18,
              humidityHigh: 80,
              humidityLow: 50,
            },
          },
        },
      },
    ),
    "danger",
  );
}

{
  let site = emptyBarnSitePrefs();
  const added = addEmptyBuilding(site);
  site = added.site;
  const live = liveZoneKeySet([preg, piglet, otherPreg]);
  const a = assignZoneToBuilding(
    site,
    added.buildingId,
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(a.ok, true);
  if (!a.ok) throw new Error("a");
  site = a.site;
  const b = assignZoneToBuilding(
    site,
    added.buildingId,
    { stallTyCode: "SP05", stallNo: "2" },
    live,
  );
  assert.equal(b.ok, true);
  if (!b.ok) throw new Error("b");
  site = b.site;

  const grouped = readingsByZoneForBuilding(site, added.buildingId, [
    preg,
    piglet,
    otherPreg,
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0]?.readings.length, 1);
  assert.equal(grouped[1]?.readings.length, 1);
  const temps = grouped.flatMap((g) => g.readings.map((r) => r.tempC)).sort();
  assert.deepEqual(temps, [22, 24]);
}

console.log("barn-site-live.test.ts: ok");
