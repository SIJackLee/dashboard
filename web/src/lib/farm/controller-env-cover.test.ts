/**
 * 실행: npx tsx src/lib/farm/controller-env-cover.test.ts
 */
import assert from "node:assert/strict";
import {
  CONTROLLER_PANEL_INTERACTIVE_SELECTOR,
  controllerEnvCoverFillClass,
  controllerEnvCoverLabel,
  controllerEnvCoverLevel,
  controllerEnvCoverRingClass,
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

{
  assert.equal(controllerEnvCoverFillClass("ok"), "bg-[var(--status-ok)]");
  assert.equal(controllerEnvCoverFillClass("warn"), "bg-[var(--status-warn)]");
  assert.equal(controllerEnvCoverFillClass("danger"), "bg-[var(--status-danger)]");
  assert.equal(controllerEnvCoverFillClass("offline"), "bg-muted-foreground");
  assert.match(controllerEnvCoverRingClass("danger"), /--status-danger/);
  assert.match(controllerEnvCoverRingClass("ok"), /--status-ok/);
}

{
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\bbutton\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\ba\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\blabel\b/);
  assert.doesNotMatch(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /role='img'/);
}

console.log("controller-env-cover.test.ts: ok");
