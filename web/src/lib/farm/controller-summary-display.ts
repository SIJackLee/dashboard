import {
  resolveThermoSettings,
  thermoFromDecoded,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
  channelBySlot,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import type { TrendPeriodData, TrendPeriodId, TrendStallSeries, TrendControllerPeriodData, TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { normalizeStallTyCode } from "@/lib/data/stall-type";

export type ListDisplayMode = "gauge";

export type ChannelPercents = Record<ChannelSlot, number | null>;

const CHANNELS: ChannelSlot[] = ["A", "B", "C"];

export { parseTrendPeriodParam as parseTrendPeriod } from "@/lib/farm/farm-view-url";

/** UI — EC 코드 대신 컨트롤러 번호만 (상위 트리에 축사 표시) */
export function formatControllerNoLabel(eqpmnNo: string | undefined): string {
  const eq = normalizeEqpmnNo(eqpmnNo ?? "01");
  return `${eq}번`;
}

export function channelPercentsFromReading(r: BarnReading): ChannelPercents {
  if (r.status === "offline") {
    return { A: null, B: null, C: null };
  }
  if (r.channels?.length) {
    return {
      A: channelBySlot(r.channels, "A")?.fanPct ?? null,
      B: channelBySlot(r.channels, "B")?.fanPct ?? null,
      C: channelBySlot(r.channels, "C")?.fanPct ?? null,
    };
  }
  return {
    A: r.fanIntake,
    B: r.fanExhaust,
    C: r.fanSupply,
  };
}

export function resolveReadingThermo(
  r: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>
): ControllerThermoSettings | null {
  const fromMap =
    resolveThermoSettings(
      thermoSettings,
      r.farmKey,
      r.moduleUid,
      r.controllerKey,
      "A"
    ) ??
    resolveThermoSettings(
      thermoSettings,
      r.farmKey,
      r.moduleUid,
      r.controllerKey
    );
  if (fromMap) return fromMap;

  const chA = r.channels?.length
    ? channelBySlot(r.channels, "A")?.thermo
    : null;
  const parsed = thermoFromDecoded(chA ?? r.thermo);
  if (!parsed) return null;
  return {
    ...parsed,
    source: "live",
    updatedAt: r.receivedAt,
  };
}

export function formatSetpointDisplay(
  thermo: ControllerThermoSettings | null
): { main: string; sub: string } {
  if (!thermo) return { main: "—", sub: "" };
  const dev =
    thermo.tempDeviation % 1 === 0
      ? String(thermo.tempDeviation)
      : thermo.tempDeviation.toFixed(1);
  return {
    main: `${thermo.setpointTemp} ±${dev}`,
    sub: `${thermo.minVentPct}–${thermo.maxVentPct}%`,
  };
}

export function findStallTrendSeries(
  trendByPeriod: Record<TrendPeriodId, TrendPeriodData> | null | undefined,
  period: TrendPeriodId,
  stallTyCode: string | null,
  stallNo: string | null
): TrendStallSeries | null {
  if (!trendByPeriod || !stallTyCode || !stallNo) return null;
  const data = trendByPeriod[period];
  if (!data) return null;
  const sp = data.sp.find(
    (g) =>
      normalizeStallTyCode(g.stallTyCode) ===
      normalizeStallTyCode(stallTyCode)
  );
  return sp?.stalls.find((s) => s.stallNo === stallNo) ?? null;
}

/** 목록 그래프 — controller_key 단위 시계열 (stall 집계와 분리). */
export function findControllerTrendSeries(
  trendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
  period: TrendPeriodId,
  stallTyCode: string | null,
  stallNo: string | null,
  controllerKey: string | null
): TrendControllerSeries | null {
  if (!trendByPeriod || !stallTyCode || !stallNo || !controllerKey) return null;
  const data = trendByPeriod[period];
  if (!data) return null;
  const sp = data.sp.find(
    (g) =>
      normalizeStallTyCode(g.stallTyCode) ===
      normalizeStallTyCode(stallTyCode)
  );
  const stall = sp?.stalls.find((s) => s.stallNo === stallNo);
  return (
    stall?.controllers.find((c) => c.controllerKey === controllerKey) ?? null
  );
}

export function formatChannelPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

export function resolveReadingAlarmThresholds(
  r: BarnReading,
  alarmSettings?: AlarmSettings
): AlarmThresholds {
  return resolveThresholdsForReading(alarmSettings ?? DEFAULT_ALARM_SETTINGS, r);
}

export function formatTempAlarmRange(thresholds: AlarmThresholds): string {
  return `${thresholds.tempLow}–${thresholds.tempHigh}℃`;
}

export function formatHumidityAlarmRange(thresholds: AlarmThresholds): string {
  return `${thresholds.humidityLow}–${thresholds.humidityHigh}%`;
}

export type AlarmBreached = "high" | "low";

export function tempAlarmBreached(
  r: BarnReading,
  thresholds: AlarmThresholds
): AlarmBreached | null {
  if (r.status === "offline" || r.tempC == null) return null;
  if (r.tempC >= thresholds.tempHigh) return "high";
  if (r.tempC <= thresholds.tempLow) return "low";
  return null;
}

export function humidityAlarmBreached(
  r: BarnReading,
  thresholds: AlarmThresholds
): AlarmBreached | null {
  if (r.status === "offline" || r.humidityPct == null) return null;
  if (r.humidityPct >= thresholds.humidityHigh) return "high";
  if (r.humidityPct <= thresholds.humidityLow) return "low";
  return null;
}

/** 게이지 bar — 알람 구간 [low, high] 내 위치 0–100% */
export function gaugePctInAlarmRange(
  value: number,
  low: number,
  high: number
): number {
  if (high <= low) return 0;
  const pct = ((value - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export type GaugeFillSegments = {
  span: number;
  cur: number;
  rest: number;
  pct: number | null;
};

export function buildGaugeFillSegments(
  value: number | null,
  low: number,
  high: number,
  offline: boolean
): GaugeFillSegments {
  const span = Math.max(high - low, 1);
  if (offline || value == null) {
    return { span, cur: 0, rest: span, pct: null };
  }
  const cur = Math.max(0, Math.min(span, value - low));
  return {
    span,
    cur,
    rest: span - cur,
    pct: gaugePctInAlarmRange(value, low, high),
  };
}

export function setpointBandPct(
  setpoint: number,
  dev: number,
  low: number,
  high: number
): { left: number; width: number } {
  const lo = gaugePctInAlarmRange(setpoint - dev, low, high);
  const hi = gaugePctInAlarmRange(setpoint + dev, low, high);
  return { left: Math.min(lo, hi), width: Math.abs(hi - lo) };
}

export { CHANNELS };
