import assert from "node:assert/strict";
import { pickController } from "@/lib/weather-control/pick-controller";
import type { ControllerCandidate } from "@/lib/weather-control/types";
import { DEFAULT_FARM } from "@/lib/data/farm-key";

const thermo = {
  setpointTemp: 24,
  tempDeviation: 2,
  minVentPct: 30,
  maxVentPct: 60,
};

function cand(
  key: string,
  tempC: number,
  status: ControllerCandidate["status"] = "normal",
  source: ControllerCandidate["settingsSource"] = "live",
): ControllerCandidate {
  return {
    farmKey: DEFAULT_FARM,
    moduleUid: 1,
    controllerKey: key,
    stallTyCode: "SP03",
    stallNo: "01",
    eqpmnNo: "06",
    label: key,
    tempC,
    humidityPct: 55,
    status,
    current: thermo,
    settingsSource: source,
    liveReceivedAt: new Date().toISOString(),
  };
}

const picked = pickController([cand("SP03:02:06", 28), cand("SP03:01:06", 27)]);
assert.equal(picked?.controllerKey, "SP03:02:06");

assert.equal(pickController([cand("SP03:01:06", 27, "offline")]), null);
assert.equal(
  pickController([cand("SP03:01:06", 27, "normal", "pending")]),
  null,
);

console.log("pick-controller.test.ts ok");
