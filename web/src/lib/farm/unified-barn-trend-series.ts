import type {
  TrendEnvelope,
  TrendEnvelopePolyPoint,
  TrendHistogram,
  TrendSeries,
  TrendSpreadContributor,
  TrendSpreadExtremes,
} from "@/components/trends/trend-chart";
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";

export const UNIFIED_TEMP_BAND_FILL = "#ef4444";
/** 온도 편차 히스토그램 — 온도감 유지, 본선(#ef4444)과 구분 */
export const DEV_HIST_COLOR_UP = "#fb923c";
export const DEV_HIST_COLOR_DOWN = "#fb7185";
/** EMA 추세선 (온도) */
export const EMA_SHORT_COLOR = "#fca5a5";
export const EMA_LONG_COLOR = "#b91c1c";

export const UNIFIED_HUM_BAND_FILL = "#0ea5e9";
/** 습도 편차 히스토그램 — 본선(#0ea5e9)과 구분 */
export const HUM_DEV_HIST_COLOR_UP = "#38bdf8";
export const HUM_DEV_HIST_COLOR_DOWN = "#818cf8";
export const HUM_EMA_SHORT_COLOR = "#7dd3fc";
export const HUM_EMA_LONG_COLOR = "#0284c7";

/** 통합 차트 UI 정식명 (범례·툴팁) */
export const UNIFIED_CHART_LABELS = {
  tempEmaShort: "온도 추세",
  tempEmaLong: "온도 장기 추세",
  humEmaShort: "습도 추세",
  humEmaLong: "습도 장기 추세",
  tempBand: "온도 산포",
  humBand: "습도 산포",
  tempDev: "온도 편차",
  humDev: "습도 편차",
  motor: "모터",
  motorA: CHANNEL_SLOT_LABELS.A,
  motorB: CHANNEL_SLOT_LABELS.B,
  motorC: CHANNEL_SLOT_LABELS.C,
} as const;

/** A안 — 임계 접촉 코리도 채움 */
export const UNIFIED_TEMP_BREACH_HI_FILL = "#ef4444";
export const UNIFIED_TEMP_BREACH_LO_FILL = "#fb7185";
export const UNIFIED_HUM_BREACH_HI_FILL = "#0ea5e9";
export const UNIFIED_HUM_BREACH_LO_FILL = "#818cf8";

/** 닿음 허용 (부동소수) */
const BREACH_TOUCH_EPS = 1e-6;

function isBreachedRaw(
  raw: number,
  thresholdRaw: number,
  side: "high" | "low",
): boolean {
  return side === "high"
    ? raw >= thresholdRaw - BREACH_TOUCH_EPS
    : raw <= thresholdRaw + BREACH_TOUCH_EPS;
}

function corridorPoint(
  x: number,
  plotY: number,
  thresholdPlot: number,
): TrendEnvelopePolyPoint {
  return {
    x,
    high: Math.max(plotY, thresholdPlot),
    low: Math.min(plotY, thresholdPlot),
  };
}

function appendCorridorPoint(
  run: TrendEnvelopePolyPoint[],
  point: TrendEnvelopePolyPoint,
) {
  const last = run[run.length - 1];
  if (last && Math.abs(last.x - point.x) < 1e-9) {
    last.high = point.high;
    last.low = point.low;
    return;
  }
  run.push(point);
}

/**
 * 본선이 상한/하한에 닿거나 넘는 구간에 본선↔임계 사이 면채움.
 * 샘플 사이 교차는 보간해 초과 구간 전체를 채운다.
 */
export function buildThresholdBreachCorridor(opts: {
  seriesPlot: (number | null)[];
  seriesRaw: (number | null)[] | null;
  thresholdRaw: number;
  thresholdPlot: number;
  side: "high" | "low";
  fill: string;
  fillOpacity?: number;
  legendLabel?: string;
}): TrendEnvelope | null {
  const {
    seriesPlot,
    seriesRaw,
    thresholdRaw,
    thresholdPlot,
    side,
    fill,
    fillOpacity = 0.2,
    legendLabel,
  } = opts;
  if (
    !seriesRaw?.length ||
    !Number.isFinite(thresholdRaw) ||
    !Number.isFinite(thresholdPlot)
  ) {
    return null;
  }
  const n = Math.min(seriesPlot.length, seriesRaw.length);
  if (n < 2) return null;

  const high: (number | null)[] = Array.from({ length: n }, () => null);
  const low: (number | null)[] = Array.from({ length: n }, () => null);
  const polys: TrendEnvelopePolyPoint[][] = [];
  let run: TrendEnvelopePolyPoint[] = [];
  let any = false;

  const flushRun = () => {
    if (run.length >= 2) polys.push(run);
    run = [];
  };

  for (let i = 0; i < n; i++) {
    const raw = seriesRaw[i];
    const plot = seriesPlot[i];
    if (
      raw == null ||
      plot == null ||
      !Number.isFinite(raw) ||
      !Number.isFinite(plot)
    ) {
      continue;
    }
    if (!isBreachedRaw(raw, thresholdRaw, side)) continue;
    high[i] = Math.max(plot, thresholdPlot);
    low[i] = Math.min(plot, thresholdPlot);
    any = true;
  }

  for (let i = 0; i < n - 1; i++) {
    const r0 = seriesRaw[i];
    const r1 = seriesRaw[i + 1];
    const p0 = seriesPlot[i];
    const p1 = seriesPlot[i + 1];
    if (
      r0 == null ||
      r1 == null ||
      p0 == null ||
      p1 == null ||
      !Number.isFinite(r0) ||
      !Number.isFinite(r1) ||
      !Number.isFinite(p0) ||
      !Number.isFinite(p1)
    ) {
      flushRun();
      continue;
    }

    const b0 = isBreachedRaw(r0, thresholdRaw, side);
    const b1 = isBreachedRaw(r1, thresholdRaw, side);
    if (!b0 && !b1) {
      flushRun();
      continue;
    }

    if (b0 && b1) {
      appendCorridorPoint(run, corridorPoint(i, p0, thresholdPlot));
      appendCorridorPoint(run, corridorPoint(i + 1, p1, thresholdPlot));
      continue;
    }

    const denom = r1 - r0;
    const t =
      Math.abs(denom) < 1e-12
        ? 0.5
        : Math.max(0, Math.min(1, (thresholdRaw - r0) / denom));
    const xCross = i + t;
    const pCross = p0 + t * (p1 - p0);
    const cross = corridorPoint(xCross, pCross, thresholdPlot);

    if (b0 && !b1) {
      appendCorridorPoint(run, corridorPoint(i, p0, thresholdPlot));
      appendCorridorPoint(run, cross);
      flushRun();
    } else {
      /* !b0 && b1 — 새 런 시작 */
      flushRun();
      appendCorridorPoint(run, cross);
      appendCorridorPoint(run, corridorPoint(i + 1, p1, thresholdPlot));
    }
  }
  flushRun();

  if (!any && polys.length === 0) return null;
  return {
    high,
    low,
    axis: "left",
    fill,
    fillOpacity,
    legendLabel,
    polys: polys.length ? polys : undefined,
  };
}

export type SplitYLayout = {
  motorLo: number;
  motorHi: number;
  humLo: number;
  humHi: number;
  tempLo: number;
  tempHi: number;
  domain: [number, number];
};

export type SplitYVisibility = {
  showTemp: boolean;
  showHum: boolean;
  showMotors: boolean;
};

/**
 * 밴드 사이 여백 (domain 0–100).
 * 모바일 ~320px 기준 ≈26px — 상·하한 라벨 칩 충돌 완화.
 */
export const SPLIT_Y_BAND_GAP = 8;

/**
 * 활성 밴드만 가중치로 0–100 분배.
 * 모터:습도:온도 ≈ 1 : 1.5 : 2.5 (단독이면 전폭).
 * 밴드 사이에는 {@link SPLIT_Y_BAND_GAP} 만큼 빈 구간.
 */
export function resolveSplitYLayout(
  visibility: boolean | SplitYVisibility,
): SplitYLayout {
  const flags: SplitYVisibility =
    typeof visibility === "boolean"
      ? {
          showTemp: true,
          showHum: visibility,
          showMotors: true,
        }
      : visibility;

  const parts: { key: "motor" | "hum" | "temp"; w: number }[] = [];
  if (flags.showMotors) parts.push({ key: "motor", w: 1 });
  if (flags.showHum) parts.push({ key: "hum", w: 1.5 });
  if (flags.showTemp) parts.push({ key: "temp", w: 2.5 });

  if (parts.length === 0) {
    return {
      motorLo: 0,
      motorHi: 0,
      humLo: 0,
      humHi: 0,
      tempLo: 0,
      tempHi: 0,
      domain: [0, 100],
    };
  }

  const sum = parts.reduce((a, p) => a + p.w, 0);
  const gapTotal = Math.max(0, parts.length - 1) * SPLIT_Y_BAND_GAP;
  const usable = Math.max(0, 100 - gapTotal);
  let cursor = 0;
  const bands: Record<"motor" | "hum" | "temp", { lo: number; hi: number }> = {
    motor: { lo: 0, hi: 0 },
    hum: { lo: 0, hi: 0 },
    temp: { lo: 0, hi: 0 },
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (i > 0) cursor += SPLIT_Y_BAND_GAP;
    const lo = cursor;
    cursor += (p.w / sum) * usable;
    bands[p.key] = { lo, hi: cursor };
  }

  return {
    motorLo: bands.motor.lo,
    motorHi: bands.motor.hi,
    humLo: bands.hum.lo,
    humHi: bands.hum.hi,
    tempLo: bands.temp.lo,
    tempHi: bands.temp.hi,
    domain: [0, 100],
  };
}

/** 습도 ON — 모터 · 습도 · 온도 (밴드 사이 갭 포함) */
export const SPLIT_Y_WITH_HUM: SplitYLayout = resolveSplitYLayout({
  showTemp: true,
  showHum: true,
  showMotors: true,
});

/** 습도 OFF — 모터 · 온도 (밴드 사이 갭 포함) */
export const SPLIT_Y_TEMP_EXPANDED: SplitYLayout = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: true,
});

/** @deprecated 습도 포함 레이아웃 별칭 */
export const SPLIT_Y = SPLIT_Y_WITH_HUM;

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** split-Y 레이아웃 선형 보간 (밴드 리플로우 모션) */
export function lerpSplitYLayout(
  from: SplitYLayout,
  to: SplitYLayout,
  t: number,
): SplitYLayout {
  const u = Math.max(0, Math.min(1, t));
  return {
    motorLo: lerpNum(from.motorLo, to.motorLo, u),
    motorHi: lerpNum(from.motorHi, to.motorHi, u),
    humLo: lerpNum(from.humLo, to.humLo, u),
    humHi: lerpNum(from.humHi, to.humHi, u),
    tempLo: lerpNum(from.tempLo, to.tempLo, u),
    tempHi: lerpNum(from.tempHi, to.tempHi, u),
    domain: [0, 100],
  };
}

export function splitYLayoutsEqual(
  a: SplitYLayout,
  b: SplitYLayout,
  eps = 1e-3,
): boolean {
  return (
    Math.abs(a.motorLo - b.motorLo) < eps &&
    Math.abs(a.motorHi - b.motorHi) < eps &&
    Math.abs(a.humLo - b.humLo) < eps &&
    Math.abs(a.humHi - b.humHi) < eps &&
    Math.abs(a.tempLo - b.tempLo) < eps &&
    Math.abs(a.tempHi - b.tempHi) < eps
  );
}

/** easeOutCubic — 밴드 채움 종료감 */
export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}

/** 알람 lo–hi 대비 상·하 여유 비율 */
export const ALARM_PAD_RATIO = 0.2;

export type UnifiedLayerId =
  | "motors"
  | "motorCh"
  | "temp"
  | "hum"
  | "band"
  | "dev"
  | "ema"
  | "humBand"
  | "humDev"
  | "humEma";

export type UnifiedLayerFlags = Record<UnifiedLayerId, boolean>;

/** 기본: 온도·습도·모터 본선 + 온·습 산포 (레이어 툴바 「기본보기」와 동일) */
export const DEFAULT_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  motorCh: false,
  temp: true,
  hum: true,
  band: true,
  dev: false,
  ema: false,
  humBand: true,
  humDev: false,
  humEma: false,
};

/** 분석용 — 본선 + 산포·편차·EMA5 + 모터 */
export const ALL_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  motorCh: false,
  temp: true,
  hum: true,
  band: true,
  dev: true,
  ema: true,
  humBand: true,
  humDev: true,
  humEma: true,
};

/** 습도 밴드가 필요한지 (본선·편차·산포·EMA) */
export function needsHumidityBand(layers: UnifiedLayerFlags): boolean {
  return layers.hum || layers.humDev || layers.humBand || layers.humEma;
}

/** split-Y에 그릴 밴드 가시성 */
export function splitYVisibilityFromLayers(
  layers: UnifiedLayerFlags,
): SplitYVisibility {
  return {
    showTemp:
      layers.temp || layers.ema || layers.dev || layers.band,
    showHum: needsHumidityBand(layers),
    showMotors: layers.motors || layers.motorCh,
  };
}

export type UnifiedYBandId = "temp" | "hum" | "motor";

export const UNIFIED_Y_BAND_LABEL: Record<UnifiedYBandId, string> = {
  temp: "온도",
  hum: "습도",
  motor: "모터",
};

/** E — UI 칩·스코프 배지: 「온도 집중」 */
export function unifiedYBandFocusLabel(band: UnifiedYBandId): string {
  return `${UNIFIED_Y_BAND_LABEL[band]} 집중`;
}

export function isSingleYBandFocus(
  yBands: UnifiedYBandId[] | null | undefined,
): yBands is [UnifiedYBandId] {
  return Array.isArray(yBands) && yBands.length === 1;
}

export function countSplitYBands(visibility: SplitYVisibility): number {
  return (
    (visibility.showTemp ? 1 : 0) +
    (visibility.showHum ? 1 : 0) +
    (visibility.showMotors ? 1 : 0)
  );
}

/**
 * 차트 domain Y(0–100) → 온/습/모터 밴드.
 * 구간 안이면 해당 밴드, 아니면 중심 최근접.
 */
export function hitSplitYBand(
  domainY: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId | null {
  const bands = listSplitYBands(layout, visibility);
  if (!bands.length || !Number.isFinite(domainY)) return null;
  for (const b of bands) {
    if (domainY >= b.lo && domainY <= b.hi) return b.id;
  }
  let best = bands[0]!;
  let bestD = Infinity;
  for (const b of bands) {
    const mid = (b.lo + b.hi) / 2;
    const d = Math.abs(domainY - mid);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best.id;
}

export function listSplitYBands(
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): { id: UnifiedYBandId; lo: number; hi: number }[] {
  const bands: { id: UnifiedYBandId; lo: number; hi: number }[] = [];
  if (visibility.showMotors && layout.motorHi - layout.motorLo > 0.5) {
    bands.push({ id: "motor", lo: layout.motorLo, hi: layout.motorHi });
  }
  if (visibility.showHum && layout.humHi - layout.humLo > 0.5) {
    bands.push({ id: "hum", lo: layout.humLo, hi: layout.humHi });
  }
  if (visibility.showTemp && layout.tempHi - layout.tempLo > 0.5) {
    bands.push({ id: "temp", lo: layout.tempLo, hi: layout.tempHi });
  }
  return bands;
}

/**
 * C안 — 드래그가 걸친 밴드 집합.
 * null = Y필터 없음(경계 모호 등, 레이어 그대로)
 * ["temp","hum"] = 그 밴드만 남김
 */
export function resolveYScopeBands(
  domainY0: number,
  domainY1: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId[] | null {
  const bands = listSplitYBands(layout, visibility);
  if (bands.length <= 1) return null;

  const yLo = Math.min(domainY0, domainY1);
  const yHi = Math.max(domainY0, domainY1);
  const span = Math.max(yHi - yLo, 1e-3);
  const center = (yLo + yHi) / 2;

  const overlaps = bands
    .map((b) => {
      const o = Math.max(0, Math.min(yHi, b.hi) - Math.max(yLo, b.lo));
      const bandH = b.hi - b.lo;
      return {
        id: b.id,
        o,
        fracBand: o / bandH,
        fracSpan: o / span,
      };
    })
    .filter((x) => x.o > 0);

  const significant = overlaps.filter(
    (x) => x.fracBand >= 0.22 || x.fracSpan >= 0.35,
  );

  const order: UnifiedYBandId[] = ["motor", "hum", "temp"];
  const sortIds = (ids: UnifiedYBandId[]) =>
    order.filter((id) => ids.includes(id));

  /** 두 밴드 이상 걸침 → 걸린 밴드만 */
  if (significant.length >= 2) {
    return sortIds(significant.map((s) => s.id));
  }

  const primary = overlaps.sort((a, b) => b.o - a.o)[0] ?? null;
  const hitId =
    primary?.id ??
    bands.find((b) => center >= b.lo && center <= b.hi)?.id ??
    null;
  if (!hitId) return null;

  const hit = bands.find((b) => b.id === hitId)!;
  const bandH = hit.hi - hit.lo;
  const edgeMargin = bandH * 0.2;
  const nearLo = center < hit.lo + edgeMargin;
  const nearHi = center > hit.hi - edgeMargin;
  const neighborLo = bands.some(
    (b) => b.id !== hit.id && Math.abs(b.hi - hit.lo) < 0.75,
  );
  const neighborHi = bands.some(
    (b) => b.id !== hit.id && Math.abs(b.lo - hit.hi) < 0.75,
  );
  if ((nearLo && neighborLo) || (nearHi && neighborHi)) return null;

  if (span < bandH * 0.15) {
    if (center >= hit.lo && center <= hit.hi) return [hitId];
    return null;
  }

  const cover = overlaps.find((x) => x.id === hitId);
  if (cover && cover.fracBand >= 0.45) return [hitId];
  if (center >= hit.lo + edgeMargin && center <= hit.hi - edgeMargin) {
    return [hitId];
  }
  return null;
}

/** @deprecated resolveYScopeBands 사용 */
export function resolveYScopeBand(
  domainY0: number,
  domainY1: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId | null {
  const bands = resolveYScopeBands(domainY0, domainY1, layout, visibility);
  if (!bands || bands.length !== 1) return null;
  return bands[0]!;
}

export function visibilityForYBands(
  bands: UnifiedYBandId[] | null,
): SplitYVisibility | null {
  if (!bands?.length) return null;
  return {
    showTemp: bands.includes("temp"),
    showHum: bands.includes("hum"),
    showMotors: bands.includes("motor"),
  };
}

export function visibilityForYBand(band: UnifiedYBandId): SplitYVisibility {
  return visibilityForYBands([band])!;
}

/** Y밴드 스코프 시 pick에서 허용 밴드 외 레이어 제외 */
export function maskLayersForYBands(
  layers: UnifiedLayerFlags,
  yBands: UnifiedYBandId[] | null,
): UnifiedLayerFlags {
  if (!yBands?.length) return layers;
  const allow = new Set(yBands);
  const keepTemp = allow.has("temp");
  const keepHum = allow.has("hum");
  const keepMotor = allow.has("motor");
  return {
    ...layers,
    temp: keepTemp && layers.temp,
    ema: keepTemp && layers.ema,
    dev: keepTemp && layers.dev,
    band: keepTemp && layers.band,
    hum: keepHum && layers.hum,
    humEma: keepHum && layers.humEma,
    humDev: keepHum && layers.humDev,
    humBand: keepHum && layers.humBand,
    motors: keepMotor && (layers.motors || layers.motorCh),
    motorCh: keepMotor && layers.motorCh,
  };
}

export function maskLayersForYBand(
  layers: UnifiedLayerFlags,
  yBand: UnifiedYBandId | null,
): UnifiedLayerFlags {
  return maskLayersForYBands(layers, yBand ? [yBand] : null);
}

export type UnifiedBuildOptions = {
  /** @deprecated showHum — visibility 사용 */
  showHum?: boolean;
  visibility?: SplitYVisibility;
  /** 지정 시 resolveSplitYLayout 대신 이 레이아웃으로 매핑 (보간 중) */
  layout?: SplitYLayout;
};

function avgFinite(nums: (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of nums) {
    if (v != null && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : null;
}

/** 알람 상·하한 ± pad → 값 도메인 */
export function paddedAlarmDomain(lo: number, hi: number): [number, number] {
  const span = Math.max(hi - lo, 1e-6);
  const pad = span * ALARM_PAD_RATIO;
  return [lo - pad, hi + pad];
}

/**
 * C2 — 밴드 1개만 ON이면 원단위 Y(℃/%) identity 레이아웃.
 * 매핑 함수가 항등이 되어 축·드래그·엣지 라벨이 실제 단위로 동작한다.
 */
export type UnifiedPlotLayoutSpec = {
  layout: SplitYLayout;
  leftUnit: string;
  nativeBand: UnifiedYBandId | null;
};

export function resolveUnifiedPlotLayout(
  visibility: SplitYVisibility,
  thresholds: Pick<
    AlarmThresholds,
    "tempLow" | "tempHigh" | "humidityLow" | "humidityHigh"
  >,
): UnifiedPlotLayoutSpec {
  const n = countSplitYBands(visibility);
  if (n === 1 && visibility.showTemp) {
    const [vlo, vhi] = paddedAlarmDomain(
      thresholds.tempLow,
      thresholds.tempHigh,
    );
    return {
      layout: {
        motorLo: 0,
        motorHi: 0,
        humLo: 0,
        humHi: 0,
        tempLo: vlo,
        tempHi: vhi,
        domain: [vlo, vhi],
      },
      leftUnit: "℃",
      nativeBand: "temp",
    };
  }
  if (n === 1 && visibility.showHum) {
    const [vlo, vhi] = paddedAlarmDomain(
      thresholds.humidityLow,
      thresholds.humidityHigh,
    );
    return {
      layout: {
        motorLo: 0,
        motorHi: 0,
        humLo: vlo,
        humHi: vhi,
        tempLo: 0,
        tempHi: 0,
        domain: [vlo, vhi],
      },
      leftUnit: "%",
      nativeBand: "hum",
    };
  }
  if (n === 1 && visibility.showMotors) {
    return {
      layout: {
        motorLo: 0,
        motorHi: 100,
        humLo: 0,
        humHi: 0,
        tempLo: 0,
        tempHi: 0,
        domain: [0, 100],
      },
      leftUnit: "%",
      nativeBand: "motor",
    };
  }
  return {
    layout: resolveSplitYLayout(visibility),
    leftUnit: "",
    nativeBand: null,
  };
}

function mapToValueBand(
  value: number | null | undefined,
  valueLo: number,
  valueHi: number,
  bandLo: number,
  bandHi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(valueHi > valueLo) || !(bandHi > bandLo)) return (bandLo + bandHi) / 2;
  const t = (value - valueLo) / (valueHi - valueLo);
  const clamped = Math.max(0, Math.min(1, t));
  return bandLo + clamped * (bandHi - bandLo);
}

/** split-Y 밴드 Y → 원단위 (드래그 역매핑). 도메인 고정용. */
function unmapFromValueBand(
  splitY: number,
  valueLo: number,
  valueHi: number,
  bandLo: number,
  bandHi: number,
): number | null {
  if (!Number.isFinite(splitY)) return null;
  if (!(valueHi > valueLo) || !(bandHi > bandLo)) return (valueLo + valueHi) / 2;
  const t = (splitY - bandLo) / (bandHi - bandLo);
  const clamped = Math.max(0, Math.min(1, t));
  return valueLo + clamped * (valueHi - valueLo);
}

/** 습도 밴드 Y → % (드래그 시작 시 고정 도메인 기준) */
export function unmapHumPctFromSplitY(
  splitY: number,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(humidityLow, humidityHigh);
  return unmapFromValueBand(splitY, vlo, vhi, layout.humLo, layout.humHi);
}

/** 온도 밴드 Y → ℃ (드래그 시작 시 고정 도메인 기준) */
export function unmapTempCFromSplitY(
  splitY: number,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(tempLow, tempHigh);
  return unmapFromValueBand(splitY, vlo, vhi, layout.tempLo, layout.tempHi);
}

/** 모터% → 모터 밴드 */
export function mapMotorPctToSplitY(
  pct: number | null | undefined,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const t = Math.max(0, Math.min(100, pct)) / 100;
  return layout.motorLo + t * (layout.motorHi - layout.motorLo);
}

/** 모터 밴드 Y → % (드래그 역매핑) */
export function unmapMotorPctFromSplitY(
  splitY: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  return unmapFromValueBand(splitY, 0, 100, layout.motorLo, layout.motorHi);
}

/** 습도% → 습도 밴드 (알람±여유) */
export function mapHumPctToSplitY(
  value: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(humidityLow, humidityHigh);
  return mapToValueBand(value, vlo, vhi, layout.humLo, layout.humHi);
}

/** 온도℃ → 주패널 밴드 (알람±여유) */
export function mapTempCToSplitY(
  value: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(tempLow, tempHigh);
  return mapToValueBand(value, vlo, vhi, layout.tempLo, layout.tempHi);
}

/**
 * 온도 편차(℃) → 온도 주패널에 오버레이.
 * 중점+편차를 온도 스케일로 매핑 (자연스러운 위치).
 */
export function mapTempDeviationToSplitY(
  deviationC: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (deviationC == null || !Number.isFinite(deviationC)) return null;
  const mid = tempAlarmMidpoint(tempLow, tempHigh);
  return mapTempCToSplitY(mid + deviationC, tempLow, tempHigh, layout);
}

/**
 * 습도 편차(%p) → 습도 밴드에 오버레이.
 */
export function mapHumDeviationToSplitY(
  deviationPct: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (deviationPct == null || !Number.isFinite(deviationPct)) return null;
  const mid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  return mapHumPctToSplitY(mid + deviationPct, humidityLow, humidityHigh, layout);
}

/** 알람 중점 (편차 0) */
export function tempAlarmMidpoint(tempLow: number, tempHigh: number): number {
  return (tempLow + tempHigh) / 2;
}

export function humidityAlarmMidpoint(
  humidityLow: number,
  humidityHigh: number,
): number {
  return (humidityLow + humidityHigh) / 2;
}

/** 단순 EMA — null은 건너뛰고 직전 상태 유지하지 않음(갭 반영). */
export function computeEmaSeries(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null);
  if (period < 1) return out;
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;
  let seedN = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    if (ema == null) {
      seedSum += v;
      seedN += 1;
      if (seedN >= period) {
        ema = seedSum / seedN;
        out[i] = ema;
      } else {
        out[i] = null;
      }
      continue;
    }
    ema = v * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** @deprecated */
export function mapEnvAbsToSplitY(
  value: number | null | undefined,
  tempLow = 10,
  tempHigh = 35,
): number | null {
  return mapTempCToSplitY(value, tempLow, tempHigh);
}

function mapColumn(
  values: (number | null)[],
  map: (v: number | null | undefined) => number | null,
): (number | null)[] {
  return values.map((v) => map(v));
}

/** @deprecated */
export function normalizeToAlarmRange(
  value: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(hi > lo)) return 50;
  const n = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, n));
}

/** @deprecated */
export function denormalizeFromAlarmRange(
  n: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (!(hi > lo)) return null;
  return lo + (n / 100) * (hi - lo);
}

function avgColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): (number | null)[] {
  const out = new Array<number | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    out[i] = avgFinite(slot);
  }
  return out;
}

function contributorLabel(c: TrendControllerSeries): {
  zoneLabel: string;
  equipmentLabel: string;
} {
  const eq = normalizeEqpmnNo(c.eqpmnNo ?? "01");
  const stall = (c.stallNo ?? "").trim() || "—";
  return {
    zoneLabel: c.zoneLabel?.trim() || "구역",
    equipmentLabel: c.equipmentLabel?.trim() || `${stall}번 축사 ${eq}`,
  };
}

function toContributor(
  c: TrendControllerSeries,
  value: number,
  breached?: boolean,
): TrendSpreadContributor {
  const labels = contributorLabel(c);
  const stallNo = (c.stallNo ?? "").trim();
  const stallTyCode = (c.stallTyCode ?? "").trim();
  return {
    zoneLabel: labels.zoneLabel,
    equipmentLabel: labels.equipmentLabel,
    value,
    breached,
    stallTyCode: stallTyCode || undefined,
    stallNo: stallNo || undefined,
    controllerKey: c.controllerKey || undefined,
  };
}

function minMaxColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): {
  min: (number | null)[];
  max: (number | null)[];
  minAt: (TrendSpreadContributor | null)[];
  maxAt: (TrendSpreadContributor | null)[];
} {
  const min = new Array<number | null>(len).fill(null);
  const max = new Array<number | null>(len).fill(null);
  const minAt = new Array<TrendSpreadContributor | null>(len).fill(null);
  const maxAt = new Array<TrendSpreadContributor | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    let minV: number | null = null;
    let maxV: number | null = null;
    let minC: TrendControllerSeries | null = null;
    let maxC: TrendControllerSeries | null = null;
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v == null || !Number.isFinite(v)) continue;
      if (minV == null || v < minV) {
        minV = v;
        minC = c;
      }
      if (maxV == null || v > maxV) {
        maxV = v;
        maxC = c;
      }
    }
    if (minV != null && minC) {
      min[i] = minV;
      minAt[i] = toContributor(minC, minV);
    }
    if (maxV != null && maxC) {
      max[i] = maxV;
      maxAt[i] = toContributor(maxC, maxV);
    }
  }
  return { min, max, minAt, maxAt };
}

/** 임계 접촉·초과 플래그 부여 */
function markSpreadBreaches(
  high: (TrendSpreadContributor | null)[],
  low: (TrendSpreadContributor | null)[],
  thresholdHigh: number,
  thresholdLow: number,
): TrendSpreadExtremes {
  return {
    high: high.map((c) =>
      c == null
        ? null
        : {
            ...c,
            breached: c.value >= thresholdHigh - BREACH_TOUCH_EPS,
          },
    ),
    low: low.map((c) =>
      c == null
        ? null
        : {
            ...c,
            breached: c.value <= thresholdLow + BREACH_TOUCH_EPS,
          },
    ),
  };
}

function hasFinite(data: (number | null)[]): boolean {
  return data.some((v) => v != null && Number.isFinite(v));
}

export type UnifiedSeriesKey =
  | "temp"
  | "hum"
  | "emaShort"
  | "emaLong"
  | "humEmaShort"
  | "humEmaLong";

export type UnifiedBarnTrendBuild = {
  categories: string[];
  seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>>;
  envelopesBand: TrendEnvelope | null;
  envelopesHumBand: TrendEnvelope | null;
  histogramDev: TrendHistogram | null;
  histogramHumDev: TrendHistogram | null;
  /** 모터 max(A,B,C) 단일 바 */
  histogramMotorsMax: TrendHistogram[];
  /** 모터 A·B·C 채널 바 */
  histogramMotorsChannels: TrendHistogram[];
  layout: SplitYLayout;
  leftDomain: [number, number];
  rightDomain: [number, number];
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thresholds: AlarmThresholds;
  available: {
    motors: boolean;
    motorCh: boolean;
    temp: boolean;
    hum: boolean;
    band: boolean;
    dev: boolean;
    ema: boolean;
    humBand: boolean;
    humDev: boolean;
    humEma: boolean;
  };
};

/** 미소 편차는 숨겨 면 채움처럼 보이지 않게 */
const DEV_HIDE_ABS_C = 0.3;
const HUM_DEV_HIDE_ABS = 0.5;
const EMA_SHORT_PERIOD = 5;
const EMA_LONG_PERIOD = 14;

/**
 * layout 무관 집계(평균·EMA·편차). M1 — 보간 rAF마다 재실행하지 않음.
 */
export type UnifiedBarnTrendRaw = {
  categories: string[];
  controllerCount: number;
  thresholds: AlarmThresholds;
  tempLow: number;
  tempHigh: number;
  humidityLow: number;
  humidityHigh: number;
  tempMid: number;
  humMid: number;
  fanA: (number | null)[];
  fanB: (number | null)[];
  fanC: (number | null)[];
  fanMaxRaw: (number | null)[];
  tempAvg: (number | null)[];
  humAvg: (number | null)[];
  tempMin: (number | null)[];
  tempMax: (number | null)[];
  humMin: (number | null)[];
  humMax: (number | null)[];
  /** 시점별 온도 산포 상·하단 기여자 */
  tempSpreadExtremes: TrendSpreadExtremes;
  /** 시점별 습도 산포 상·하단 기여자 */
  humSpreadExtremes: TrendSpreadExtremes;
  emaShortRaw: (number | null)[];
  emaLongRaw: (number | null)[];
  humEmaShortRaw: (number | null)[];
  humEmaLongRaw: (number | null)[];
  tempDevRaw: (number | null)[];
  humDevRaw: (number | null)[];
  tempDevOpacity: (number | null)[];
  humDevOpacity: (number | null)[];
  tempRangeLabel: string;
  humidityRangeLabel: string;
};

export function aggregateUnifiedBarnTrendRaw(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
): UnifiedBarnTrendRaw | null {
  const len = categories.length;
  if (!len || !controllerSeriesList.length) return null;

  const { tempLow, tempHigh, humidityLow, humidityHigh } = thresholds;
  const tempMid = tempAlarmMidpoint(tempLow, tempHigh);
  const humMid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  const tempAlarmHalfSpan = Math.max((tempHigh - tempLow) / 2, 1e-6);
  const humAlarmHalfSpan = Math.max((humidityHigh - humidityLow) / 2, 1e-6);

  const fanA = avgColumns(controllerSeriesList, (c) => c.fanIntake, len);
  const fanB = avgColumns(controllerSeriesList, (c) => c.fanExhaust, len);
  const fanC = avgColumns(controllerSeriesList, (c) => c.fanSupply, len);
  const tempAvg = avgColumns(controllerSeriesList, (c) => c.temp, len);
  const humAvg = avgColumns(controllerSeriesList, (c) => c.humidity, len);
  const tempSpread = minMaxColumns(controllerSeriesList, (c) => c.temp, len);
  const humSpread = minMaxColumns(
    controllerSeriesList,
    (c) => c.humidity,
    len,
  );
  const tempSpreadExtremes = markSpreadBreaches(
    tempSpread.maxAt,
    tempSpread.minAt,
    tempHigh,
    tempLow,
  );
  const humSpreadExtremes = markSpreadBreaches(
    humSpread.maxAt,
    humSpread.minAt,
    humidityHigh,
    humidityLow,
  );

  const emaShortRaw = computeEmaSeries(tempAvg, EMA_SHORT_PERIOD);
  const emaLongRaw = computeEmaSeries(tempAvg, EMA_LONG_PERIOD);
  const humEmaShortRaw = computeEmaSeries(humAvg, EMA_SHORT_PERIOD);
  const humEmaLongRaw = computeEmaSeries(humAvg, EMA_LONG_PERIOD);

  const tempDevRaw = tempAvg.map((t) =>
    t == null || !Number.isFinite(t) ? null : t - tempMid,
  );
  const tempDevOpacity = tempDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return Math.abs(d) > tempAlarmHalfSpan ? 0.32 : 0.1;
  });

  const humDevRaw = humAvg.map((h) =>
    h == null || !Number.isFinite(h) ? null : h - humMid,
  );
  const humDevOpacity = humDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return Math.abs(d) > humAlarmHalfSpan ? 0.32 : 0.1;
  });

  const fanMaxRaw: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const v of [fanA[i], fanB[i], fanC[i]]) {
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    fanMaxRaw[i] = slot.length ? Math.max(...slot) : null;
  }

  return {
    categories,
    controllerCount: controllerSeriesList.length,
    thresholds,
    tempLow,
    tempHigh,
    humidityLow,
    humidityHigh,
    tempMid,
    humMid,
    fanA,
    fanB,
    fanC,
    fanMaxRaw,
    tempAvg,
    humAvg,
    tempMin: tempSpread.min,
    tempMax: tempSpread.max,
    humMin: humSpread.min,
    humMax: humSpread.max,
    tempSpreadExtremes,
    humSpreadExtremes,
    emaShortRaw,
    emaLongRaw,
    humEmaShortRaw,
    humEmaLongRaw,
    tempDevRaw,
    humDevRaw,
    tempDevOpacity,
    humDevOpacity,
    tempRangeLabel: formatTempAlarmRange(thresholds),
    humidityRangeLabel: formatHumidityAlarmRange(thresholds),
  };
}

/** raw → split-Y 플롯. layout 보간 프레임마다 호출해도 집계 비용 없음. */
export function mapUnifiedBarnTrendRawToSplitY(
  raw: UnifiedBarnTrendRaw,
  layout: SplitYLayout,
): UnifiedBarnTrendBuild | null {
  const {
    tempLow,
    tempHigh,
    humidityLow,
    humidityHigh,
    tempMid,
    humMid,
  } = raw;

  const mapTemp = (v: number | null | undefined) =>
    mapTempCToSplitY(v, tempLow, tempHigh, layout);
  const mapHum = (v: number | null | undefined) =>
    mapHumPctToSplitY(v, humidityLow, humidityHigh, layout);
  const mapMotor = (v: number | null | undefined) =>
    mapMotorPctToSplitY(v, layout);

  const tempPlot = mapColumn(raw.tempAvg, mapTemp);
  const humPlot = mapColumn(raw.humAvg, mapHum);
  const tempMinPlot = mapColumn(raw.tempMin, mapTemp);
  const tempMaxPlot = mapColumn(raw.tempMax, mapTemp);
  const humMinPlot = mapColumn(raw.humMin, mapHum);
  const humMaxPlot = mapColumn(raw.humMax, mapHum);
  const emaShortPlot = mapColumn(raw.emaShortRaw, mapTemp);
  const emaLongPlot = mapColumn(raw.emaLongRaw, mapTemp);
  const humEmaShortPlot = mapColumn(raw.humEmaShortRaw, mapHum);
  const humEmaLongPlot = mapColumn(raw.humEmaLongRaw, mapHum);

  const tempDevPlot = mapColumn(raw.tempDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return mapTempDeviationToSplitY(d, tempLow, tempHigh, layout);
  });
  const tempMidPlot = mapTempCToSplitY(tempMid, tempLow, tempHigh, layout);

  const humDevPlot = mapColumn(raw.humDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return mapHumDeviationToSplitY(d, humidityLow, humidityHigh, layout);
  });
  const humMidPlot = mapHumPctToSplitY(humMid, humidityLow, humidityHigh, layout);

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(tempPlot)) {
    seriesByKey.temp = {
      name: "온도",
      data: tempPlot,
      color: TREND_CHART_COLORS.temp,
      axis: "left",
      hoverSecondary: raw.tempAvg,
      hoverSecondaryUnit: "℃",
      hoverAlarmBand: {
        lo: tempLow,
        hi: tempHigh,
        unit: "℃",
      },
      hoverSpreadExtremes: raw.tempSpreadExtremes,
    };
  }
  if (hasFinite(humPlot)) {
    seriesByKey.hum = {
      name: "습도",
      data: humPlot,
      color: TREND_CHART_COLORS.humidity,
      axis: "left",
      hoverSecondary: raw.humAvg,
      hoverSecondaryUnit: "%",
      hoverAlarmBand: {
        lo: humidityLow,
        hi: humidityHigh,
        unit: "%",
      },
      hoverSpreadExtremes: raw.humSpreadExtremes,
    };
  }
  if (hasFinite(emaShortPlot)) {
    seriesByKey.emaShort = {
      name: UNIFIED_CHART_LABELS.tempEmaShort,
      data: emaShortPlot,
      color: EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.emaShortRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(emaLongPlot)) {
    seriesByKey.emaLong = {
      name: UNIFIED_CHART_LABELS.tempEmaLong,
      data: emaLongPlot,
      color: EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.emaLongRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humEmaShortPlot)) {
    seriesByKey.humEmaShort = {
      name: UNIFIED_CHART_LABELS.humEmaShort,
      data: humEmaShortPlot,
      color: HUM_EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.humEmaShortRaw,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(humEmaLongPlot)) {
    seriesByKey.humEmaLong = {
      name: UNIFIED_CHART_LABELS.humEmaLong,
      data: humEmaLongPlot,
      color: HUM_EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.humEmaLongRaw,
      hoverSecondaryUnit: "%",
    };
  }

  const fanAPlot = mapColumn(raw.fanA, mapMotor);
  const fanBPlot = mapColumn(raw.fanB, mapMotor);
  const fanCPlot = mapColumn(raw.fanC, mapMotor);
  const fanMaxPlot = mapColumn(raw.fanMaxRaw, mapMotor);

  const motorDefs = [
    {
      plot: fanAPlot,
      raw: raw.fanA,
      color: TREND_CHART_COLORS.fanIntake,
      label: UNIFIED_CHART_LABELS.motorA,
    },
    {
      plot: fanBPlot,
      raw: raw.fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      label: UNIFIED_CHART_LABELS.motorB,
    },
    {
      plot: fanCPlot,
      raw: raw.fanC,
      color: TREND_CHART_COLORS.fanSupply,
      label: UNIFIED_CHART_LABELS.motorC,
    },
  ].filter((m) => hasFinite(m.raw));

  const motorHoverChannels = motorDefs.map((m) => ({
    label: m.label,
    color: m.color,
    values: m.raw,
  }));

  const histogramMotorsMax: TrendHistogram[] = hasFinite(raw.fanMaxRaw)
    ? [
        {
          values: fanMaxPlot,
          baseline: layout.motorLo,
          colorUp: TREND_CHART_COLORS.fanIntake,
          colorDown: TREND_CHART_COLORS.fanIntake,
          style: "volume" as const,
          legendLabel: UNIFIED_CHART_LABELS.motor,
          hoverSecondary: raw.fanMaxRaw,
          hoverSecondaryUnit: "%",
          hoverChannels: motorHoverChannels,
        },
      ]
    : [];

  const histogramMotorsChannels: TrendHistogram[] = motorDefs.map((m, i) => ({
    values: m.plot,
    baseline: layout.motorLo,
    colorUp: m.color,
    colorDown: m.color,
    style: "volume" as const,
    groupIndex: i,
    groupSize: motorDefs.length,
    legendLabel: m.label,
    hoverSecondary: m.raw,
    hoverSecondaryUnit: "%",
    hoverChannels: motorHoverChannels,
  }));

  const hasMotors =
    histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0;

  if (
    !Object.keys(seriesByKey).length &&
    !hasFinite(tempDevPlot) &&
    !hasFinite(humDevPlot) &&
    !hasMotors
  ) {
    return null;
  }

  const envelopesBand =
    hasFinite(tempMinPlot) && hasFinite(tempMaxPlot)
      ? {
          high: tempMaxPlot,
          low: tempMinPlot,
          axis: "left" as const,
          fill: UNIFIED_TEMP_BAND_FILL,
          fillOpacity: 0.12,
          legendLabel: UNIFIED_CHART_LABELS.tempBand,
          hoverExtremes: raw.tempSpreadExtremes,
        }
      : null;

  const envelopesHumBand =
    hasFinite(humMinPlot) && hasFinite(humMaxPlot)
      ? {
          high: humMaxPlot,
          low: humMinPlot,
          axis: "left" as const,
          fill: UNIFIED_HUM_BAND_FILL,
          fillOpacity: 0.14,
          legendLabel: UNIFIED_CHART_LABELS.humBand,
          hoverExtremes: raw.humSpreadExtremes,
        }
      : null;

  const histogramDev =
    hasFinite(tempDevPlot) && tempMidPlot != null
      ? {
          values: tempDevPlot,
          baseline: tempMidPlot,
          colorUp: DEV_HIST_COLOR_UP,
          colorDown: DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.tempDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.tempDev,
          hoverSecondary: raw.tempDevRaw,
          hoverSecondaryUnit: "℃",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  const histogramHumDev =
    hasFinite(humDevPlot) && humMidPlot != null
      ? {
          values: humDevPlot,
          baseline: humMidPlot,
          colorUp: HUM_DEV_HIST_COLOR_UP,
          colorDown: HUM_DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.humDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.humDev,
          hoverSecondary: raw.humDevRaw,
          hoverSecondaryUnit: "%",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  return {
    categories: raw.categories,
    seriesByKey,
    envelopesBand,
    envelopesHumBand,
    histogramDev,
    histogramHumDev,
    histogramMotorsMax,
    histogramMotorsChannels,
    layout,
    leftDomain: [...layout.domain],
    rightDomain: [...layout.domain],
    controllerCount: raw.controllerCount,
    tempRangeLabel: raw.tempRangeLabel,
    humidityRangeLabel: raw.humidityRangeLabel,
    thresholds: raw.thresholds,
    available: {
      motors: hasMotors,
      motorCh: histogramMotorsChannels.length > 0,
      temp: Boolean(seriesByKey.temp),
      hum: Boolean(seriesByKey.hum),
      band: Boolean(envelopesBand),
      dev: Boolean(histogramDev),
      ema: Boolean(seriesByKey.emaShort),
      humBand: Boolean(envelopesHumBand),
      humDev: Boolean(histogramHumDev),
      humEma: Boolean(seriesByKey.humEmaShort),
    },
  };
}

/**
 * 패널 내 컨트롤러 equally 평균 → split Y.
 * M1: 내부적으로 집계+매핑. 보간 경로에서는 aggregate/map 분리 사용.
 */
export function buildUnifiedBarnTrendSeries(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
  options: UnifiedBuildOptions = {},
): UnifiedBarnTrendBuild | null {
  const raw = aggregateUnifiedBarnTrendRaw(
    controllerSeriesList,
    categories,
    thresholds,
  );
  if (!raw) return null;

  const visibility: SplitYVisibility = options.visibility ?? {
    showTemp: true,
    showHum: options.showHum ?? false,
    showMotors: true,
  };
  const layout = options.layout ?? resolveSplitYLayout(visibility);
  void visibility;
  return mapUnifiedBarnTrendRawToSplitY(raw, layout);
}

export function pickUnifiedTrendLayers(
  built: UnifiedBarnTrendBuild,
  layers: UnifiedLayerFlags,
): {
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
} {
  const series: TrendSeries[] = [];
  if (layers.temp && built.seriesByKey.temp) series.push(built.seriesByKey.temp);
  if (layers.temp && layers.ema) {
    if (built.seriesByKey.emaShort) series.push(built.seriesByKey.emaShort);
  }
  if (layers.hum && built.seriesByKey.hum) series.push(built.seriesByKey.hum);
  if (layers.hum && layers.humEma) {
    if (built.seriesByKey.humEmaShort) series.push(built.seriesByKey.humEmaShort);
  }

  const envelopes: TrendEnvelope[] = [];
  if (layers.temp && layers.band && built.envelopesBand) {
    envelopes.push(built.envelopesBand);
  }
  if (layers.hum && layers.humBand && built.envelopesHumBand) {
    envelopes.push(built.envelopesHumBand);
  }
  /* A안 — 임계 접촉 코리도 (본선↔상·하한) */
  if (layers.temp && built.seriesByKey.temp) {
    const raw = built.seriesByKey.temp.hoverSecondary ?? null;
    const plot = built.seriesByKey.temp.data;
    const { tempLow, tempHigh } = built.thresholds;
    const hiPlot = mapTempCToSplitY(
      tempHigh,
      tempLow,
      tempHigh,
      built.layout,
    );
    const loPlot = mapTempCToSplitY(
      tempLow,
      tempLow,
      tempHigh,
      built.layout,
    );
    if (hiPlot != null) {
      const hiEnv = buildThresholdBreachCorridor({
        seriesPlot: plot,
        seriesRaw: raw,
        thresholdRaw: tempHigh,
        thresholdPlot: hiPlot,
        side: "high",
        fill: UNIFIED_TEMP_BREACH_HI_FILL,
        fillOpacity: 0.2,
        legendLabel: "온도 상한 접촉",
      });
      if (hiEnv) envelopes.push(hiEnv);
    }
    if (loPlot != null) {
      const loEnv = buildThresholdBreachCorridor({
        seriesPlot: plot,
        seriesRaw: raw,
        thresholdRaw: tempLow,
        thresholdPlot: loPlot,
        side: "low",
        fill: UNIFIED_TEMP_BREACH_LO_FILL,
        fillOpacity: 0.18,
        legendLabel: "온도 하한 접촉",
      });
      if (loEnv) envelopes.push(loEnv);
    }
  }
  if (layers.hum && built.seriesByKey.hum) {
    const raw = built.seriesByKey.hum.hoverSecondary ?? null;
    const plot = built.seriesByKey.hum.data;
    const { humidityLow, humidityHigh } = built.thresholds;
    const hiPlot = mapHumPctToSplitY(
      humidityHigh,
      humidityLow,
      humidityHigh,
      built.layout,
    );
    const loPlot = mapHumPctToSplitY(
      humidityLow,
      humidityLow,
      humidityHigh,
      built.layout,
    );
    if (hiPlot != null) {
      const hiEnv = buildThresholdBreachCorridor({
        seriesPlot: plot,
        seriesRaw: raw,
        thresholdRaw: humidityHigh,
        thresholdPlot: hiPlot,
        side: "high",
        fill: UNIFIED_HUM_BREACH_HI_FILL,
        fillOpacity: 0.2,
        legendLabel: "습도 상한 접촉",
      });
      if (hiEnv) envelopes.push(hiEnv);
    }
    if (loPlot != null) {
      const loEnv = buildThresholdBreachCorridor({
        seriesPlot: plot,
        seriesRaw: raw,
        thresholdRaw: humidityLow,
        thresholdPlot: loPlot,
        side: "low",
        fill: UNIFIED_HUM_BREACH_LO_FILL,
        fillOpacity: 0.18,
        legendLabel: "습도 하한 접촉",
      });
      if (loEnv) envelopes.push(loEnv);
    }
  }

  const histograms: TrendHistogram[] = [];
  if (layers.temp && layers.dev && built.histogramDev) {
    histograms.push(built.histogramDev);
  }
  if (layers.hum && layers.humDev && built.histogramHumDev) {
    histograms.push(built.histogramHumDev);
  }
  if (layers.motors) {
    if (layers.motorCh && built.histogramMotorsChannels.length) {
      histograms.push(...built.histogramMotorsChannels);
    } else {
      histograms.push(...built.histogramMotorsMax);
    }
  }

  return { series, envelopes, histograms };
}

/** X스코프/트림 시 코리도 폴리 x를 [lo,hi]로 자르고 0 기준으로 재배치 */
function sliceEnvelopePolys(
  polys: TrendEnvelope["polys"] | undefined,
  lo: number,
  hi: number,
): TrendEnvelope["polys"] | undefined {
  if (!polys?.length) return polys;
  const out: TrendEnvelopePolyPoint[][] = [];

  const lerp = (
    a: TrendEnvelopePolyPoint,
    b: TrendEnvelopePolyPoint,
    x: number,
  ): TrendEnvelopePolyPoint => {
    const t = Math.abs(b.x - a.x) < 1e-12 ? 0 : (x - a.x) / (b.x - a.x);
    return {
      x,
      high: a.high + t * (b.high - a.high),
      low: a.low + t * (b.low - a.low),
    };
  };

  for (const run of polys) {
    if (run.length < 2) continue;
    const clipped: TrendEnvelopePolyPoint[] = [];
    for (let i = 0; i < run.length; i++) {
      const p = run[i]!;
      const prev = i > 0 ? run[i - 1]! : null;
      if (p.x >= lo && p.x <= hi) {
        if (clipped.length === 0 && prev && prev.x < lo) {
          clipped.push(lerp(prev, p, lo));
        }
        clipped.push(p);
      } else if (prev && prev.x <= hi && p.x > hi) {
        if (clipped.length === 0 && prev.x < lo) {
          clipped.push(lerp(prev, p, lo));
        } else if (clipped.length === 0 && prev.x >= lo && prev.x <= hi) {
          clipped.push(prev);
        }
        clipped.push(lerp(prev, p, hi));
      }
    }
    if (clipped.length < 2) continue;
    out.push(
      clipped.map((p) => ({
        x: p.x - lo,
        high: p.high,
        low: p.low,
      })),
    );
  }
  return out.length ? out : undefined;
}

/** 유한값이 있는 첫·끝 인덱스 */
export function findFiniteIndexSpan(
  columns: ((number | null)[] | undefined | null)[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (const col of columns) {
    if (!col?.length) continue;
    for (let i = 0; i < col.length; i++) {
      const v = col[i];
      if (v != null && Number.isFinite(v)) {
        if (start < 0 || i < start) start = i;
        if (i > end) end = i;
      }
    }
  }
  if (start < 0 || end < start) return null;
  return { start, end };
}

/**
 * 선두·후미 결측을 잘라 실데이터 구간에 맞춤 (좌우 소량 패딩).
 */
export function trimPickedUnifiedTrend(
  categories: string[],
  picked: {
    series: TrendSeries[];
    envelopes: TrendEnvelope[];
    histograms: TrendHistogram[];
  },
): {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  trimmed: boolean;
} {
  const n = categories.length;
  if (n < 4) {
    return { categories, ...picked, trimmed: false };
  }

  const span = findFiniteIndexSpan([
    ...picked.series.map((s) => s.data),
    ...picked.series.map((s) => s.hoverSecondary),
    ...picked.envelopes.flatMap((e) => [e.high, e.low]),
    ...picked.histograms.map((h) => h.values),
    ...picked.histograms.map((h) => h.hoverSecondary),
  ]);
  if (!span) {
    return { categories, ...picked, trimmed: false };
  }

  const pad = Math.max(1, Math.min(4, Math.round(n * 0.03)));
  const start = Math.max(0, span.start - pad);
  const end = Math.min(n - 1, span.end + pad);
  if (start <= 0 && end >= n - 1) {
    return { categories, ...picked, trimmed: false };
  }

  const sliceCol = <T,>(arr: (T | null)[] | undefined): (T | null)[] | undefined =>
    arr ? arr.slice(start, end + 1) : arr;
  const sliceExtremes = (
    ex: TrendSeries["hoverSpreadExtremes"] | TrendEnvelope["hoverExtremes"],
  ) =>
    ex
      ? {
          high: ex.high.slice(start, end + 1),
          low: ex.low.slice(start, end + 1),
        }
      : ex;

  return {
    categories: categories.slice(start, end + 1),
    series: picked.series.map((s) => ({
      ...s,
      data: s.data.slice(start, end + 1),
      hoverSecondary: sliceCol(s.hoverSecondary),
      hoverSpreadExtremes: sliceExtremes(s.hoverSpreadExtremes),
    })),
    envelopes: picked.envelopes.map((e) => ({
      ...e,
      high: e.high.slice(start, end + 1),
      low: e.low.slice(start, end + 1),
      hoverExtremes: sliceExtremes(e.hoverExtremes),
      polys: sliceEnvelopePolys(e.polys, start, end),
    })),
    histograms: picked.histograms.map((h) => ({
      ...h,
      values: h.values.slice(start, end + 1),
      hoverSecondary: sliceCol(h.hoverSecondary),
      fillOpacityValues: sliceCol(h.fillOpacityValues),
      hoverChannels: h.hoverChannels?.map((ch) => ({
        ...ch,
        values: ch.values.slice(start, end + 1),
      })),
    })),
    trimmed: true,
  };
}

/**
 * 사용자 X스코프 — [start, end] inclusive로 카테고리·시리즈 슬라이스.
 */
export function sliceUnifiedTrendByIndex(
  categories: string[],
  picked: {
    series: TrendSeries[];
    envelopes: TrendEnvelope[];
    histograms: TrendHistogram[];
  },
  start: number,
  end: number,
): {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
} {
  const n = categories.length;
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(n - 1, Math.max(start, end));
  if (n === 0 || lo > hi) {
    return { categories, ...picked };
  }
  if (lo === 0 && hi === n - 1) {
    return { categories, ...picked };
  }

  const sliceCol = <T,>(arr: (T | null)[] | undefined): (T | null)[] | undefined =>
    arr ? arr.slice(lo, hi + 1) : arr;
  const sliceExtremes = (
    ex: TrendSeries["hoverSpreadExtremes"] | TrendEnvelope["hoverExtremes"],
  ) =>
    ex
      ? {
          high: ex.high.slice(lo, hi + 1),
          low: ex.low.slice(lo, hi + 1),
        }
      : ex;

  return {
    categories: categories.slice(lo, hi + 1),
    series: picked.series.map((s) => ({
      ...s,
      data: s.data.slice(lo, hi + 1),
      hoverSecondary: sliceCol(s.hoverSecondary),
      hoverSpreadExtremes: sliceExtremes(s.hoverSpreadExtremes),
    })),
    envelopes: picked.envelopes.map((e) => ({
      ...e,
      high: e.high.slice(lo, hi + 1),
      low: e.low.slice(lo, hi + 1),
      hoverExtremes: sliceExtremes(e.hoverExtremes),
      polys: sliceEnvelopePolys(e.polys, lo, hi),
    })),
    histograms: picked.histograms.map((h) => ({
      ...h,
      values: h.values.slice(lo, hi + 1),
      hoverSecondary: sliceCol(h.hoverSecondary),
      fillOpacityValues: sliceCol(h.fillOpacityValues),
      hoverChannels: h.hoverChannels?.map((ch) => ({
        ...ch,
        values: ch.values.slice(lo, hi + 1),
      })),
    })),
  };
}
