import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";
import type { BarnReading } from "@/lib/data/iot";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import {
  compareStallNo,
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import {
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import type { BarnPlanEnvBandMode } from "@/lib/farm/barn-plan-phase";
import {
  barnSiteCoverKey,
  barnSiteRoomKey,
  barnSiteZoneKey,
  type BarnSitePrefs,
  type BarnSiteZone,
} from "@/lib/farm/barn-site-types";
import { zonesForBuilding } from "@/lib/farm/barn-site-prefs";
import {
  PIG_ENV_SAFETY,
  pigEnvFitOffBand,
  pigEnvTypeVerdicts,
  type PigEnvFit,
} from "@/lib/farm/pig-env-recommend";
import { sevOfScore, severityScore } from "@/lib/farm/severity-score";

export type LiveZoneRef = {
  stallTyCode: string;
  stallNo: string;
};

/** LIVE 축사유형+축사번호. 미지정 번호는 제외. */
export function listLiveZones(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo">[],
): LiveZoneRef[] {
  const seen = new Set<string>();
  const out: LiveZoneRef[] = [];
  for (const r of readings) {
    const stallNo = stallKeyFromReading(r);
    if (stallNo.startsWith("__")) continue;
    const key = barnSiteZoneKey(r.stallTyCode, stallNo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      stallTyCode: normalizeStallTyCode(r.stallTyCode),
      stallNo,
    });
  }
  out.sort((a, b) => {
    const byType =
      stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
    if (byType !== 0) return byType;
    return compareStallNo(a.stallNo, b.stallNo);
  });
  return out;
}

/** LIVE에 있는 유형+축사번호. 건물 평균 없음. */
export function liveZoneKeySet(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo">[],
): Set<string> {
  const keys = new Set<string>();
  for (const r of readings) {
    const key = barnSiteZoneKey(r.stallTyCode, stallKeyFromReading(r));
    if (key) keys.add(key);
  }
  return keys;
}

export type LiveControllerRef = {
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
};

/** LIVE 컨트롤러. 축사번호가 있는 행만. */
export function listLiveControllers(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo" | "eqpmnNo">[],
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): LiveControllerRef[] {
  const ty = normalizeStallTyCode(stallTyCode);
  const want = barnSiteZoneKey(ty, stallNo);
  if (!want) return [];
  const seen = new Set<string>();
  const out: LiveControllerRef[] = [];
  for (const r of readings) {
    const stall = stallKeyFromReading(r);
    if (stall.startsWith("__")) continue;
    const zoneKey = barnSiteZoneKey(r.stallTyCode, stall);
    if (zoneKey !== want) continue;
    const eqpmnNo = normalizeEqpmnNo(r.eqpmnNo);
    const key = barnSiteCoverKey(ty, want.slice(want.indexOf("#") + 1), eqpmnNo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      stallTyCode: ty,
      stallNo: want.slice(want.indexOf("#") + 1),
      eqpmnNo,
    });
  }
  out.sort((a, b) => a.eqpmnNo.localeCompare(b.eqpmnNo, "ko", { numeric: true }));
  return out;
}

export function liveCoverKeySet(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo" | "eqpmnNo">[],
): Set<string> {
  const keys = new Set<string>();
  for (const r of readings) {
    const stallNo = stallKeyFromReading(r);
    if (stallNo.startsWith("__")) continue;
    const key = barnSiteCoverKey(
      r.stallTyCode,
      stallNo,
      normalizeEqpmnNo(r.eqpmnNo),
    );
    if (key) keys.add(key);
  }
  return keys;
}

/** 연결한 축사유형+축사번호+컨트롤러에 해당하는 LIVE 한 줄. */
export function readingForCover<
  T extends Pick<BarnReading, "stallTyCode" | "stallNo" | "eqpmnNo">,
>(
  readings: T[],
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
  eqpmnNo: string | null | undefined,
): T | undefined {
  const ty = normalizeStallTyCode(stallTyCode);
  const want = barnSiteZoneKey(ty, stallNo);
  const eq = normalizeEqpmnNo(eqpmnNo ?? "");
  if (!want || !eq) return undefined;
  return readings.find((r) => {
    const stall = stallKeyFromReading(r);
    if (stall.startsWith("__")) return false;
    if (barnSiteZoneKey(r.stallTyCode, stall) !== want) return false;
    return normalizeEqpmnNo(r.eqpmnNo) === eq;
  });
}

export type BarnPlanCoverClimateTone = "ok" | "warn" | "danger" | "offline";
export type BarnPlanRoomEnvTint = "ok" | "warn" | "danger";

export type BarnPlanRoomEnvChannels = {
  temp: BarnPlanRoomEnvTint | null;
  humidity: BarnPlanRoomEnvTint | null;
};

export type BarnPlanCoverClimate = {
  tempText: string | null;
  humidityText: string | null;
  tone: BarnPlanCoverClimateTone;
};

export type BarnPlanRoomEnvTintOptions = {
  mode?: BarnPlanEnvBandMode;
  alarmSettings?: AlarmSettings;
};

type BarnPlanEnvTintReading = Pick<
  BarnReading,
  "tempC" | "humidityPct" | "status" | "stallTyCode"
> &
  Partial<
    Pick<BarnReading, "farmKey" | "stallNo" | "controllerKey" | "eqpmnNo">
  >;

function tintFromOffBands(
  tempOff: boolean,
  humOff: boolean,
): BarnPlanRoomEnvTint {
  if (tempOff && humOff) return "danger";
  if (tempOff || humOff) return "warn";
  return "ok";
}

function channelOff(tint: BarnPlanRoomEnvTint | null): boolean {
  return tint === "warn" || tint === "danger";
}

function recommendChannelTint(
  value: number | null | undefined,
  fit: PigEnvFit | undefined,
  safetyLow: number,
  safetyHigh: number,
): BarnPlanRoomEnvTint | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= safetyLow || value >= safetyHigh) return "danger";
  if (fit == null || fit === "none") return null;
  if (pigEnvFitOffBand(fit)) return "warn";
  return "ok";
}

function alarmChannelTint(
  value: number | null | undefined,
  low: number,
  high: number,
): BarnPlanRoomEnvTint | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sev = sevOfScore(severityScore(value, { lo: low, hi: high }));
  if (sev === "warning") return "danger";
  if (sev === "caution") return "warn";
  return "ok";
}

export function barnPlanRoomEnvOverall(
  channels: BarnPlanRoomEnvChannels,
): BarnPlanRoomEnvTint {
  if (channels.temp === "danger" || channels.humidity === "danger") {
    return "danger";
  }
  return tintFromOffBands(
    channelOff(channels.temp),
    channelOff(channels.humidity),
  );
}

/** 알람 모드 — 히트맵과 같이 채널 최악. 주의+주의는 주의(둘 다 이탈해도 위험으로 올리지 않음). */
function worstEnvChannelTint(
  channels: BarnPlanRoomEnvChannels,
): BarnPlanRoomEnvTint {
  if (channels.temp === "danger" || channels.humidity === "danger") {
    return "danger";
  }
  if (channels.temp === "warn" || channels.humidity === "warn") {
    return "warn";
  }
  return "ok";
}

function barnPlanRoomEnvTintForMode(
  channels: BarnPlanRoomEnvChannels,
  mode: BarnPlanEnvBandMode,
): BarnPlanRoomEnvTint {
  return mode === "recommend"
    ? barnPlanRoomEnvOverall(channels)
    : worstEnvChannelTint(channels);
}

export function barnPlanEnvAlarmThresholds(
  reading: BarnPlanEnvTintReading,
  settings?: AlarmSettings,
): AlarmThresholds {
  return resolveThresholdsForReading(settings ?? DEFAULT_ALARM_SETTINGS, {
    key: "",
    farmKey: reading.farmKey ?? { lsindRegistNo: "", itemCode: "" },
    moduleUid: 0,
    controllerKey: reading.controllerKey ?? "",
    eqpmnNo: reading.eqpmnNo ?? "",
    stallNo: reading.stallNo ?? null,
    stallTyCode: reading.stallTyCode ?? null,
    label: "",
    tempC: reading.tempC,
    humidityPct: reading.humidityPct,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: "",
    status: reading.status,
    packetMode: "live",
    wireVer: null,
  });
}

type BarnPlanCoverReading = Pick<
  BarnReading,
  "stallTyCode" | "stallNo" | "eqpmnNo" | "tempC" | "humidityPct" | "status"
> &
  Partial<Pick<BarnReading, "farmKey" | "controllerKey">>;

type BarnPlanCoverRooms = readonly {
  rooms: readonly { bank: number; index: number }[];
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
}[];

/** 생성: 온도·습도 각각 정상/주의/위험. 기본은 알람 띠(히트맵과 같은 점수). 권장 모드는 유형 이탈=주의, 안전망=위험. */
export function barnPlanRoomEnvChannels(
  reading: BarnPlanEnvTintReading | undefined,
  options?: BarnPlanRoomEnvTintOptions,
): BarnPlanRoomEnvChannels | null {
  if (!reading || reading.status === "offline") return null;
  const mode = options?.mode ?? "alarm";
  if (mode === "alarm") {
    if (reading.tempC == null && reading.humidityPct == null) return null;
    const band = barnPlanEnvAlarmThresholds(reading, options?.alarmSettings);
    return {
      temp: alarmChannelTint(reading.tempC, band.tempLow, band.tempHigh),
      humidity: alarmChannelTint(
        reading.humidityPct,
        band.humidityLow,
        band.humidityHigh,
      ),
    };
  }
  const verdict = pigEnvTypeVerdicts([reading])[0];
  const temp = recommendChannelTint(
    reading.tempC,
    verdict?.tempFit,
    PIG_ENV_SAFETY.tempLowC,
    PIG_ENV_SAFETY.tempHighC,
  );
  const humidity = recommendChannelTint(
    reading.humidityPct,
    verdict?.humidityFit,
    PIG_ENV_SAFETY.humidityLowPct,
    PIG_ENV_SAFETY.humidityHighPct,
  );
  if (temp == null && humidity == null) return null;
  return { temp, humidity };
}

export function barnPlanRoomEnvTint(
  reading: BarnPlanEnvTintReading | undefined,
  options?: BarnPlanRoomEnvTintOptions,
): BarnPlanRoomEnvTint | null {
  const channels = barnPlanRoomEnvChannels(reading, options);
  if (!channels) return null;
  return barnPlanRoomEnvTintForMode(channels, options?.mode ?? "alarm");
}

/** 컨트롤러 구획 → 방별 온도·습도 판정. */
export function barnPlanRoomEnvMarks(
  covers: BarnPlanCoverRooms,
  readings: BarnPlanCoverReading[],
  options?: BarnPlanRoomEnvTintOptions,
): Record<string, BarnPlanRoomEnvChannels> {
  const out: Record<string, BarnPlanRoomEnvChannels> = {};
  for (const cover of covers) {
    const channels = barnPlanRoomEnvChannels(
      readingForCover(
        readings,
        cover.stallTyCode,
        cover.stallNo,
        cover.eqpmnNo,
      ),
      options,
    );
    if (!channels) continue;
    for (const room of cover.rooms) {
      out[barnSiteRoomKey(room.bank, room.index)] = channels;
    }
  }
  return out;
}

/** 컨트롤러 구획 → 그 방들의 환경 틴트(한 색). */
export function barnPlanRoomEnvTints(
  covers: BarnPlanCoverRooms,
  readings: BarnPlanCoverReading[],
  options?: BarnPlanRoomEnvTintOptions,
): Record<string, BarnPlanRoomEnvTint> {
  const out: Record<string, BarnPlanRoomEnvTint> = {};
  const marks = barnPlanRoomEnvMarks(covers, readings, options);
  const mode = options?.mode ?? "alarm";
  for (const [key, channels] of Object.entries(marks)) {
    out[key] = barnPlanRoomEnvTintForMode(channels, mode);
  }
  return out;
}

/** 생성 단계 이름 태그용. 값은 필드 카드와 같이 숫자만(단위는 UI). */
export function barnPlanCoverClimate(
  reading:
    | Pick<BarnReading, "tempC" | "humidityPct" | "status" | "stallTyCode">
    | undefined,
  options?: BarnPlanRoomEnvTintOptions,
): BarnPlanCoverClimate {
  if (!reading || reading.status === "offline") {
    return { tempText: null, humidityText: null, tone: "offline" };
  }
  const tempText = formatSensorNumberForDisplay(reading.status, reading.tempC);
  const humidityText = formatSensorNumberForDisplay(
    reading.status,
    reading.humidityPct,
  );
  return {
    tempText,
    humidityText,
    tone: barnPlanRoomEnvTint(reading, options) ?? "ok",
  };
}

export function readingsForZone<
  T extends Pick<BarnReading, "stallTyCode" | "stallNo">,
>(
  readings: T[],
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): T[] {
  const ty = normalizeStallTyCode(stallTyCode);
  const no = (stallNo ?? "").trim();
  if (!ty || ty === "UNK" || !no) return [];
  return readings.filter(
    (r) =>
      normalizeStallTyCode(r.stallTyCode) === ty && stallKeyFromReading(r) === no,
  );
}

export type BarnSiteZoneReadings<T> = {
  zone: BarnSiteZone;
  readings: T[];
};

/** 건물 안 구역별 LIVE. 합산·평균 함수 없음. */
export function readingsByZoneForBuilding<
  T extends Pick<BarnReading, "stallTyCode" | "stallNo">,
>(
  site: BarnSitePrefs,
  buildingId: string,
  readings: T[],
): BarnSiteZoneReadings<T>[] {
  return zonesForBuilding(site, buildingId).map((zone) => ({
    zone,
    readings: readingsForZone(readings, zone.stallTyCode, zone.stallNo),
  }));
}
