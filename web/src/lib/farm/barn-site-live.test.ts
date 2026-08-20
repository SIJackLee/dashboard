/**
 * 실행: npx tsx src/lib/farm/barn-site-live.test.ts
 */
import assert from "node:assert/strict";
import {
  listLiveZones,
  liveZoneKeySet,
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
  const only = readingsForZone([preg, piglet, otherPreg], "SP02", "1");
  assert.equal(only.length, 1);
  assert.equal(only[0]?.tempC, 24);
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
