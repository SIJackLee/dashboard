/**
 * 실행: npx tsx src/lib/farm/controller-env-cover.test.ts
 */
import assert from "node:assert/strict";
import {
  controllerEnvCoverLabel,
  controllerEnvCoverLevel,
} from "./controller-env-cover";

{
  assert.equal(controllerEnvCoverLabel("ok"), "정상");
  assert.equal(controllerEnvCoverLabel("warn"), "주의");
  assert.equal(controllerEnvCoverLabel("danger"), "위험");
  assert.equal(controllerEnvCoverLabel("offline"), "연결 끊김");
}

{
  assert.equal(
    controllerEnvCoverLevel({
      status: "offline",
      tempC: 24,
      humidityPct: 55,
      stallTyCode: "SP02",
    }),
    "offline",
  );
}

{
  const level = controllerEnvCoverLevel({
    status: "normal",
    tempC: 36.5,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(level, "danger");
}

{
  const level = controllerEnvCoverLevel({
    status: "normal",
    tempC: 20,
    humidityPct: 60,
    stallTyCode: "SP05",
  });
  assert.equal(level, "ok");
}

console.log("controller-env-cover.test.ts: ok");
