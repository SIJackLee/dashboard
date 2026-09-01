/**
 * Split-Y 레이아웃 · 레이어/Y-band 순수 로직.
 *
 * `unified-barn-trend-series.ts`에서 분리(동작 보존). 밴드 배치·가시성·
 * 레이어 마스킹 등 순수 기하/설정 로직만 포함하며 집계·빌드에 의존하지 않는다.
 * 기존 import 호환을 위해 `unified-barn-trend-series.ts`가 이 모듈을 배럴 재노출한다.
 */

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
