/**
 * 실행: npx tsx src/lib/farm/controller-env-cover.test.ts
 */
import assert from "node:assert/strict";
import {
  CONTROLLER_PANEL_INTERACTIVE_SELECTOR,
  controllerEnvCoverFillClass,
  controllerEnvCoverInkClass,
  controllerEnvCoverLabel,
  controllerEnvCoverLevel,
  controllerEnvCoverReason,
  controllerEnvCoverRingClass,
  worstControllerEnvCoverLevel,
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
    tempC: 34,
    humidityPct: 55,
    stallTyCode: "SP05",
  });
  assert.equal(level, "warn");
}

{
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        status: "normal",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
      {
        status: "normal",
        tempC: 36,
        humidityPct: 55,
        stallTyCode: "SP05",
      },
    ]),
    "danger",
  );
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        status: "offline",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
      {
        status: "normal",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
    ]),
    "ok",
  );
  assert.equal(
    worstControllerEnvCoverLevel([
      {
        status: "offline",
        tempC: 20,
        humidityPct: 60,
        stallTyCode: "SP05",
      },
    ]),
    "offline",
  );
}

{
  assert.equal(controllerEnvCoverFillClass("ok"), "bg-[var(--status-ok)]");
  assert.equal(controllerEnvCoverFillClass("warn"), "bg-[var(--status-warn)]");
  assert.equal(controllerEnvCoverFillClass("danger"), "bg-[var(--status-danger)]");
  assert.equal(controllerEnvCoverFillClass("offline"), "bg-muted-foreground");
  assert.equal(
    controllerEnvCoverInkClass("ok"),
    "text-[var(--status-ok-ink)]",
  );
  assert.equal(
    controllerEnvCoverInkClass("warn"),
    "text-[var(--status-warn-ink)]",
  );
  assert.equal(
    controllerEnvCoverInkClass("danger"),
    "text-[var(--status-danger-ink)]",
  );
  assert.equal(controllerEnvCoverInkClass("offline"), "text-muted-foreground");
  assert.match(controllerEnvCoverRingClass("danger"), /--status-danger/);
  assert.match(controllerEnvCoverRingClass("ok"), /--status-ok/);
}

{
  const offline = controllerEnvCoverReason({
    status: "offline",
    tempC: 24,
    humidityPct: 55,
    stallTyCode: "SP02",
  });
  assert.equal(offline.valueLabel, null);
  assert.equal(offline.bandLabel, null);
}

{
  const tempFirst = controllerEnvCoverReason({
    status: "normal",
    tempC: 36.5,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(tempFirst.valueLabel, "36.5℃");
  assert.equal(tempFirst.bandLabel, "알람 10~35℃");
}

{
  const humidityOnly = controllerEnvCoverReason({
    status: "normal",
    tempC: 18,
    humidityPct: 93,
    stallTyCode: "SP02",
  });
  assert.equal(humidityOnly.valueLabel, "93.0%");
  assert.equal(humidityOnly.bandLabel, "알람 30~90%");
}

{
  const okTemp = controllerEnvCoverReason({
    status: "normal",
    tempC: 20,
    humidityPct: 60,
    stallTyCode: "SP05",
  });
  assert.equal(okTemp.valueLabel, "20.0℃");
  assert.equal(okTemp.bandLabel, "알람 10~35℃");
}

{
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\bbutton\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\ba\b/);
  assert.match(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /\blabel\b/);
  assert.doesNotMatch(CONTROLLER_PANEL_INTERACTIVE_SELECTOR, /role='img'/);
}

console.log("controller-env-cover.test.ts: ok");
