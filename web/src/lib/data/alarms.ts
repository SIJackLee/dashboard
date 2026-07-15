import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { compareReadings } from "@/lib/data/reading-hierarchy";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";

export type AlarmSeverity = "warning" | "critical";

export type AlarmRow = {
  id: string;
  occurredAt: string;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  idx?: number;
  eqpmnNo: string;
  stallNo: string | null;
  stallTyCode: string | null;
  alarmType: string;
  severity: AlarmSeverity;
  status: "active" | "resolved";
  detail: string;
  controllerStatus: ControllerStatus;
};

export type AlarmThresholds = {
  tempHigh: number;
  tempLow: number;
  humidityHigh: number;
  humidityLow: number;
};

export const DEFAULT_ALARM_THRESHOLDS: AlarmThresholds = {
  tempHigh: 35,
  tempLow: 10,
  humidityHigh: 90,
  humidityLow: 30,
};

export type AlarmSettings = {
  global: AlarmThresholds;
  /** @deprecated farm-scoped overrides in byScope preferred */
  byStallTyCode: Record<string, AlarmThresholds>;
  /** farm → sp → stall → controller hierarchical overrides */
  byScope?: Record<string, AlarmThresholds>;
};

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  global: DEFAULT_ALARM_THRESHOLDS,
  byStallTyCode: {},
  byScope: {},
};

export function resolveThresholds(
  settings: AlarmSettings,
  stallTyCode: string | null
): AlarmThresholds {
  if (stallTyCode && settings.byStallTyCode[stallTyCode]) {
    return settings.byStallTyCode[stallTyCode];
  }
  return settings.global;
}

export function deriveAlarmsFromReadings(
  readings: BarnReading[],
  settings: AlarmSettings | AlarmThresholds = DEFAULT_ALARM_SETTINGS
): AlarmRow[] {
  const rows: AlarmRow[] = [];

  for (const r of readings) {
    const thresholds =
      "global" in settings
        ? resolveThresholdsForReading(settings, r)
        : settings;

    if (r.tempC != null) {
      if (r.tempC >= thresholds.tempHigh) {
        rows.push(makeAlarm(r, "온도 상한 초과", "critical", `${r.tempC}℃ ≥ ${thresholds.tempHigh}℃`));
      } else if (r.tempC <= thresholds.tempLow) {
        rows.push(makeAlarm(r, "온도 하한 미만", "warning", `${r.tempC}℃ ≤ ${thresholds.tempLow}℃`));
      }
    }
    if (r.humidityPct != null) {
      if (r.humidityPct >= thresholds.humidityHigh) {
        rows.push(makeAlarm(r, "습도 상한 초과", "warning", `${r.humidityPct}% ≥ ${thresholds.humidityHigh}%`));
      } else if (r.humidityPct <= thresholds.humidityLow) {
        rows.push(makeAlarm(r, "습도 하한 미만", "warning", `${r.humidityPct}% ≤ ${thresholds.humidityLow}%`));
      }
    }
    if (r.status === "offline") {
      rows.push(makeAlarm(r, "통신 두절", "critical", "15분 이상 미수신"));
    }
  }

  return rows.sort((a, b) => {
    const hierarchyCmp = compareReadings(
      alarmAsReading(a),
      alarmAsReading(b)
    );
    if (hierarchyCmp !== 0) return hierarchyCmp;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });
}

function alarmAsReading(a: AlarmRow): BarnReading {
  return {
    key: a.id,
    farmKey: a.farmKey,
    moduleUid: a.moduleUid,
    controllerKey: a.controllerKey,
    idx: a.idx,
    eqpmnNo: a.eqpmnNo,
    stallNo: a.stallNo,
    stallTyCode: a.stallTyCode,
    label: "",
    tempC: null,
    humidityPct: null,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: a.occurredAt,
    status: a.controllerStatus,
    packetMode: "live",
    wireVer: null,
  };
}

function makeAlarm(
  r: BarnReading,
  alarmType: string,
  severity: AlarmSeverity,
  detail: string
): AlarmRow {
  return {
    id: `${r.key}-${alarmType}`,
    occurredAt: r.receivedAt,
    farmKey: r.farmKey,
    moduleUid: r.moduleUid,
    controllerKey: r.controllerKey,
    idx: r.idx,
    eqpmnNo: r.eqpmnNo,
    stallNo: r.stallNo,
    stallTyCode: r.stallTyCode,
    alarmType,
    severity,
    status: r.status === "offline" ? "active" : "active",
    detail,
    controllerStatus: r.status,
  };
}

export function summarizeAlarms(alarms: AlarmRow[]) {
  return {
    total: alarms.length,
    critical: alarms.filter((a) => a.severity === "critical").length,
    warning: alarms.filter((a) => a.severity === "warning").length,
    offline: alarms.filter((a) => a.alarmType === "통신 두절").length,
  };
}

/**
 * TopBar bell → 컨트롤러 deep link.
 * 레거시 map 드릴(FarmMapGraphStage) 제거 — 목록 뷰(ControllerSummaryGaugeRow)로 진입해
 * 해당 controllerKey 카드로 스크롤·하이라이트한다.
 */
export function alarmControlHref(
  alarm: Pick<
    AlarmRow,
    "farmKey" | "stallTyCode" | "stallNo" | "controllerKey" | "idx"
  >
): string {
  return buildControllerHref({
    farmKey: alarm.farmKey,
    sp: alarm.stallTyCode,
    stallNo: alarm.stallNo,
    controllerKey: alarm.controllerKey,
    ctrlIdx: alarm.idx,
    view: "list",
  });
}

export function validateAlarmThresholds(t: AlarmThresholds): string | null {
  if (t.tempHigh <= t.tempLow) return "온도 상한은 하한보다 커야 합니다.";
  if (t.humidityHigh <= t.humidityLow) return "습도 상한은 하한보다 커야 합니다.";
  if (t.tempLow < 10 || t.tempHigh > 35) return "온도 범위는 10~35℃ 이내로 설정하세요.";
  if (t.humidityLow < 0 || t.humidityHigh > 100) return "습도 범위는 0~100% 이내로 설정하세요.";
  return null;
}
