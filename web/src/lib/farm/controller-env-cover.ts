import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { formatHumidityPct, formatTempC } from "@/lib/data/farm-summaries";
import {
  barnPlanEnvAlarmThresholds,
  barnPlanRoomEnvChannels,
  barnPlanRoomEnvTint,
  type BarnPlanCoverClimateTone,
  type BarnPlanRoomEnvTint,
} from "@/lib/farm/barn-site-live";

export type ControllerEnvCoverLevel = BarnPlanCoverClimateTone;

const COVER_LEVEL_RANK: Record<ControllerEnvCoverLevel, number> = {
  ok: 0,
  warn: 1,
  danger: 2,
  offline: 3,
};

type CoverReasonReading = Pick<
  BarnReading,
  "status" | "tempC" | "humidityPct" | "stallTyCode"
> &
  Partial<Pick<BarnReading, "farmKey" | "stallNo" | "controllerKey" | "eqpmnNo">>;

/** 필드 카드 덮개 채점 — 사용자가 정한 알람 상·하한. 권장은 델린이 제시. */
export function controllerEnvCoverLevel(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverLevel {
  if (reading.status === "offline") return "offline";
  const tint =
    barnPlanRoomEnvTint(reading, { mode: "alarm", alarmSettings }) ?? "ok";
  /**
   * 측정 정체(수신은 최신·측정시각 정체 → LIVE `caution`)면
   * 알람 구간 안이어도 덮개를 「주의」로 강등. 이미 위험이면 유지.
   */
  if (reading.status === "caution" && tint === "ok") return "warn";
  return tint;
}

/** 축사 현황 — 속한 컨트롤러 중 가장 나쁜 알람 판정. 끊김만 있으면 연결 끊김. */
export function worstControllerEnvCoverLevel(
  readings: readonly CoverReasonReading[],
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverLevel {
  let worstLive: ControllerEnvCoverLevel | null = null;
  let anyOffline = false;
  for (const reading of readings) {
    const level = controllerEnvCoverLevel(reading, alarmSettings);
    if (level === "offline") {
      anyOffline = true;
      continue;
    }
    if (
      !worstLive ||
      COVER_LEVEL_RANK[level] > COVER_LEVEL_RANK[worstLive]
    ) {
      worstLive = level;
    }
  }
  if (worstLive) return worstLive;
  if (anyOffline) return "offline";
  return "ok";
}

export function controllerEnvCoverLabel(level: ControllerEnvCoverLevel): string {
  if (level === "ok") return "정상";
  if (level === "warn") return "주의";
  if (level === "danger") return "위험";
  return "연결 끊김";
}

export type ControllerEnvCoverReason = {
  valueLabel: string | null;
  bandLabel: string | null;
};

function channelOff(tint: BarnPlanRoomEnvTint | null | undefined): boolean {
  return tint === "warn" || tint === "danger";
}

function tempAlarmBandLabel(reading: CoverReasonReading, alarmSettings?: AlarmSettings): string {
  const band = barnPlanEnvAlarmThresholds(reading, alarmSettings);
  return `알람 ${band.tempLow}~${band.tempHigh}℃`;
}

function humidityAlarmBandLabel(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): string {
  const band = barnPlanEnvAlarmThresholds(reading, alarmSettings);
  return `알람 ${band.humidityLow}~${band.humidityHigh}%`;
}

/**
 * 덮개 가운데 — 이탈한 채널만. 온·습 둘 다 이탈이면 온도 우선.
 * 이탈이 없으면 온도(없으면 습도) + 알람 띠. 끊김·값 없음이면 비움.
 */
export function controllerEnvCoverReason(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverReason {
  if (reading.status === "offline") {
    return { valueLabel: null, bandLabel: null };
  }

  const channels = barnPlanRoomEnvChannels(reading, {
    mode: "alarm",
    alarmSettings,
  });
  const tempOff = channelOff(channels?.temp);
  const humidityOff = channelOff(channels?.humidity);
  const showHumidity =
    humidityOff && !tempOff && reading.humidityPct != null;
  const showTemp =
    !showHumidity && reading.tempC != null && Number.isFinite(reading.tempC);

  if (showTemp) {
    return {
      valueLabel: formatTempC(reading.tempC),
      bandLabel: tempAlarmBandLabel(reading, alarmSettings),
    };
  }
  if (
    showHumidity ||
    (reading.humidityPct != null && Number.isFinite(reading.humidityPct))
  ) {
    return {
      valueLabel: formatHumidityPct(reading.humidityPct),
      bandLabel: humidityAlarmBandLabel(reading, alarmSettings),
    };
  }
  return { valueLabel: null, bandLabel: null };
}

/** 덮개 글자 — 면과 같은 색상각, 더 진함. 흰/검정 잉크 없음. */
export function controllerEnvCoverInkClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "text-[var(--status-ok-ink)]";
  if (level === "warn") return "text-[var(--status-warn-ink)]";
  if (level === "danger") return "text-[var(--status-danger-ink)]";
  return "text-muted-foreground";
}

/** 헤더 점 — 덮개와 같은 판정색. */
export function controllerEnvCoverFillClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "bg-[var(--status-ok)]";
  if (level === "warn") return "bg-[var(--status-warn)]";
  if (level === "danger") return "bg-[var(--status-danger)]";
  return "bg-muted-foreground";
}

/** 카드 테두리 — 덮개·점과 같은 판정색. */
export function controllerEnvCoverRingClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-ok)_70%,transparent)] -outline-offset-1";
  }
  if (level === "warn") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-warn)_80%,transparent)] -outline-offset-1";
  }
  if (level === "danger") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-danger)_80%,transparent)] -outline-offset-1";
  }
  return "outline outline-2 outline-muted-foreground/40 -outline-offset-1";
}

/** 차트·설정·명칭 등 실제 컨트롤. 여기가 아니면 덮개 다시 닫기. */
export const CONTROLLER_PANEL_INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, summary, label, [role='button'], [role='switch'], [role='tab'], [role='slider'], [role='combobox'], [role='menuitem']";

export function isControllerPanelInteractiveTarget(
  target: EventTarget | null,
): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return Boolean(el?.closest(CONTROLLER_PANEL_INTERACTIVE_SELECTOR));
}
