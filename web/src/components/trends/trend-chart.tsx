"use client";

import { useMemo, useState, useRef, useLayoutEffect, useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { abbreviateTrendAxisLabel } from "@/lib/farm/trend-display-buckets";
import {
  type Band,
  SEV_COLOR,
  sevOfScore,
  severityScore,
} from "@/lib/farm/severity-score";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";

export type TrendAxis = "left" | "right";

export type TrendSeries = {
  name: string;
  data: (number | null)[];
  /** Hex color for line/bar/legend. */
  color: string;
  axis?: TrendAxis;
  /**
   * 알람/환기 한계 — 점선 + 주의·경고 마커.
   */
  band?: Band | null;
  /** line 모드 stroke-dasharray (예: "5 3"). 없으면 실선. */
  strokeDasharray?: string;
  /**
   * 호버 보조값(정규화 n 옆 원단위 등). data와 동일 길이.
   */
  hoverSecondary?: (number | null)[];
  hoverSecondaryUnit?: string;
};

/** 두 곡선 사이 면(이목 클라우드·온도 산포 등). */
export type TrendEnvelope = {
  high: (number | null)[];
  low: (number | null)[];
  axis?: TrendAxis;
  fill: string;
  fillOpacity?: number;
  /** 범례 라벨 (없으면 숨김). */
  legendLabel?: string;
};

/** MACD형 편차 막대 / 거래량형 바 — baseline↔value. */
export type TrendHistogram = {
  /** chart domain Y (막대 끝) */
  values: (number | null)[];
  /** chart domain Y (0선 또는 밴드 바닥) */
  baseline: number;
  colorUp: string;
  colorDown: string;
  /**
   * macd: +/− 양방향(기본).
   * volume: 바닥→값, colorUp만 (거래량).
   * overlay: 주패널 위에 얹는 macd(낮은 불투명도).
   */
  style?: "macd" | "volume" | "overlay";
  /** volume 그룹 내 슬롯 (0..groupSize-1) */
  groupIndex?: number;
  groupSize?: number;
  fillOpacity?: number;
  /** 인덱스별 불투명도(있으면 fillOpacity보다 우선) */
  fillOpacityValues?: (number | null)[];
  legendLabel?: string;
  /** 호버 원단위 (예: 편차 ℃ · 모터 %) */
  hoverSecondary?: (number | null)[];
  hoverSecondaryUnit?: string;
  /** midpointDelta: "중점 ±n.n℃" */
  hoverFormat?: "signed" | "percent" | "midpointDelta";
};

export type TrendReferenceLine = {
  value: number;
  axis?: TrendAxis;
  color: string;
  label?: string;
  /** true면 끝단 숫자 라벨 숨김(구분선 전용). */
  hideLabel?: boolean;
};

/** 스케일 상하한 라벨 — split Y 등에서 원단위 표기. */
export type TrendScaleEdgeLabel = {
  id: string;
  /** 차트 domain Y */
  value: number;
  axis?: TrendAxis;
  side?: "left" | "right";
  text: string;
  color: string;
  title?: string;
  mark?: "overline" | "underline";
  /** 해당 Y에 점선 가이드 */
  showLine?: boolean;
};

type TrendChartProps = {
  mode: "line" | "bar";
  categories: string[];
  series: TrendSeries[];
  height?: number;
  leftUnit?: string;
  rightUnit?: string;
  /** Force axis domains; otherwise auto-fit with padding. */
  leftDomain?: [number, number];
  rightDomain?: [number, number];
  referenceLines?: TrendReferenceLine[];
  /** 우측/좌측 스케일 상하한(원단위 텍스트). */
  scaleEdgeLabels?: TrendScaleEdgeLabel[];
  /** line 모드 — 시리즈 아래 면 채우기(클라우드·밴드). */
  envelopes?: TrendEnvelope[];
  /** line 모드 — MACD형 히스토그램 막대. */
  histograms?: TrendHistogram[];
  emptyLabel?: string;
  /** Show every Nth category tick (auto if omitted). */
  tickEvery?: number;
  /** 있으면 X축 tick을 양끝=풀·중간=축약 (categories·툴팁은 풀 라벨 유지). */
  period?: TrendPeriodId;
  /** false면 시리즈 범례 행 숨김 (sheet compact 등). */
  showLegend?: boolean;
  /**
   * bar 모드 — 바 1개의 최대 너비(차트 폭 % 단위, 0~100).
   * 카테고리 수가 적을 때 통짜 바가 되지 않게 상한을 두고 슬롯 중앙에 정렬한다.
   * (viewBox가 non-uniform 스케일이라 px 대신 % 단위를 사용)
   */
  barWidthCapPct?: number;
  /** line 모드 데이터 점 표시. 기본 true. */
  showMarkers?: boolean;
  /**
   * 마커 밀도 — all=전점, sparse≈8점/시리즈(+호버 강조점).
   * 차트 탭 반응성용 sparse 권장.
   */
  markerDensity?: "all" | "sparse";
  /** 화면 기준 점 반지름(px). preserveAspectRatio=none 보정에 사용. */
  markerRadiusPx?: number;
  /**
   * 차트 탭 enter motion — 마운트 1회만 reveal/stagger.
   * 기간·레이어 변경 시 remount 없음.
   */
  animate?: boolean;
  /**
   * line 모드 — 전 시리즈가 null인 연속 구간을 세로 음영(결측)으로 표시.
   */
  showNullGaps?: boolean;
};

const PAD_X = 6;
const PAD_TOP = 6;
const VIEW_W = 100;

/** 호버 툴팁 — 온도·습도 소수 1자리, 모터(%) 정수. */
export function formatTrendHoverValue(
  value: number,
  unit: string,
  seriesName: string,
): string {
  if (!Number.isFinite(value)) return "–";
  const motorLike =
    unit === "%" &&
    (seriesName.startsWith("채널") ||
      seriesName === "A" ||
      seriesName === "B" ||
      seriesName === "C" ||
      seriesName.includes("모터"));
  if (motorLike) return `${Math.round(value)}${unit}`;
  if (unit === "n") {
    return `n=${Number.isInteger(value) ? String(value) : value.toFixed(0)}`;
  }
  if (unit === "℃" || unit === "%") return `${value.toFixed(1)}${unit}`;
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}${unit}`;
}

/** 한계 끝단 라벨 — 정수면 그대로, 아니면 소수 1자리. */
export function formatTrendBandEdge(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "–";
  const rounded =
    Math.abs(value - Math.round(value)) < 1e-6
      ? String(Math.round(value))
      : value.toFixed(1);
  return `${rounded}${unit}`;
}

type EdgeBandLabel = {
  id: string;
  side: "left" | "right";
  /** 0~100, 차트 영역 기준 top % */
  topPct: number;
  text: string;
  color: string;
  title: string;
  /** 상한=숫자 위 선, 하한=숫자 아래 선 */
  mark?: "overline" | "underline";
};

/** 같은 끝단에서 가까운 라벨을 위·아래로 살짝 밀어 겹침을 줄인다. */
function nudgeEdgeLabelTops(labels: EdgeBandLabel[], minGapPct: number): EdgeBandLabel[] {
  const bySide: Record<"left" | "right", EdgeBandLabel[]> = {
    left: [],
    right: [],
  };
  for (const l of labels) bySide[l.side].push({ ...l });
  for (const side of ["left", "right"] as const) {
    const list = bySide[side].sort((a, b) => a.topPct - b.topPct);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (cur.topPct - prev.topPct < minGapPct) {
        cur.topPct = Math.min(96, prev.topPct + minGapPct);
      }
    }
    bySide[side] = list;
  }
  return [...bySide.left, ...bySide.right];
}

function finiteValues(series: TrendSeries[], axis: TrendAxis | undefined): number[] {
  const out: number[] = [];
  for (const s of series) {
    if ((s.axis ?? "left") !== (axis ?? "left")) continue;
    for (const v of s.data) {
      if (v != null && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

function domainFor(
  values: number[],
  forced: [number, number] | undefined,
): [number, number] {
  if (forced) return forced;
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

export function TrendChart({
  mode,
  categories,
  series,
  height = 132,
  leftUnit = "",
  rightUnit = "",
  leftDomain,
  rightDomain,
  referenceLines = [],
  scaleEdgeLabels = [],
  envelopes = [],
  histograms = [],
  emptyLabel = "데이터 없음",
  tickEvery,
  period,
  barWidthCapPct,
  showLegend = true,
  showMarkers = true,
  markerDensity = "all",
  markerRadiusPx = 3,
  animate = false,
  showNullGaps = false,
}: TrendChartProps) {
  /** 호버 — 인덱스 변경 시에만 setState (mousemove 전량 리렌더 방지) */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const hoverSeriesRef = useRef<string | null>(null);
  const crossVRef = useRef<SVGLineElement | null>(null);
  const crossHRef = useRef<SVGLineElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [plotPx, setPlotPx] = useState({ w: 1, h: 1 });
  const glowFilterId = `tc-glow-${useId().replace(/:/g, "")}`;
  /** 기간·데이터 변경 시 enter motion 재실행 */
  const [enterMotion, setEnterMotion] = useState(false);

  useLayoutEffect(() => {
    if (!animate) {
      setEnterMotion(false);
      return;
    }
    setEnterMotion(true);
    const t = window.setTimeout(() => setEnterMotion(false), 560);
    return () => window.clearTimeout(t);
  }, [animate, categories.length, period, series.length, histograms.length]);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let tid = 0;
    const apply = () => {
      window.clearTimeout(tid);
      tid = window.setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setPlotPx((prev) =>
            Math.abs(prev.w - rect.width) < 0.5 &&
            Math.abs(prev.h - rect.height) < 0.5
              ? prev
              : { w: rect.width, h: rect.height },
          );
        }
      }, 100);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      window.clearTimeout(tid);
      ro.disconnect();
    };
  }, [height, categories.length, series.length]);

  const hasAny =
    series.some((s) => s.data?.some((v) => v != null)) ||
    histograms.some((h) => h.values.some((v) => v != null));
  const n = categories.length;

  const axisH = 16;
  const chartH = height - axisH;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = chartH - PAD_TOP * 2;

  /** preserveAspectRatio=none 에서 원이 옆으로 퍼지지 않도록 viewBox rx/ry 보정 */
  const markerRx = (rPx: number) => (rPx * VIEW_W) / Math.max(1, plotPx.w);
  const markerRy = (rPx: number) => (rPx * chartH) / Math.max(1, plotPx.h);

  const usesRight = series.some((s) => s.axis === "right") || referenceLines.some((r) => r.axis === "right");

  const [lMin, lMax] = domainFor(finiteValues(series, "left"), leftDomain);
  const [rMin, rMax] = domainFor(finiteValues(series, "right"), rightDomain);

  const yFor = (value: number, axis: TrendAxis): number => {
    const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
    const t = (value - mn) / (mx - mn || 1);
    return PAD_TOP + innerH - t * innerH;
  };

  const xFor = (i: number): number => {
    if (n <= 1) return PAD_X + innerW / 2;
    return PAD_X + (i / (n - 1)) * innerW;
  };

  const barGroupW = n > 0 ? innerW / n : innerW;
  const rawBarW =
    series.length > 0 ? (barGroupW * 0.7) / series.length : barGroupW * 0.7;
  const barW =
    barWidthCapPct != null ? Math.min(rawBarW, barWidthCapPct) : rawBarW;
  const barSlotW = barW * Math.max(1, series.length);

  /** 팬 1~4개 — 차트 중앙 기준 클러스터(1=중앙, 2=중앙 좌·우). 5개 이상은 전폭 분산. */
  const barCenterCluster = mode === "bar" && n > 0 && n <= 4;

  const xForBar = (i: number): number => {
    const center = PAD_X + innerW / 2;
    if (n <= 1) return center;
    if (!barCenterCluster) return xFor(i);
    const spacing = Math.min(
      Math.max(barSlotW * 1.25, innerW / (n + 2)),
      n > 1 ? innerW / (n - 1) : innerW,
    );
    const span = (n - 1) * spacing;
    return center - span / 2 + i * spacing;
  };

  const xAtIndex = (i: number): number =>
    mode === "bar" ? xForBar(i) : xFor(i);

  const setCrosshairVisible = (visible: boolean) => {
    const op = visible ? "1" : "0";
    if (crossVRef.current) crossVRef.current.style.opacity = op;
    if (crossHRef.current) crossHRef.current.style.opacity = op;
  };

  const setCrosshairAt = (xView: number, yView: number) => {
    if (crossVRef.current) {
      crossVRef.current.setAttribute("x1", String(xView));
      crossVRef.current.setAttribute("x2", String(xView));
    }
    if (crossHRef.current) {
      crossHRef.current.setAttribute("y1", String(yView));
      crossHRef.current.setAttribute("y2", String(yView));
    }
    setCrosshairVisible(true);
  };

  /** 데이터 점 근처 · 플롯 안 · 포인터/점을 가리지 않게 카드 배치 */
  const placeTipNear = (
    anchorX: number,
    anchorY: number,
    plotW: number,
    plotH: number,
  ) => {
    const el = tipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth || 168;
    const tipH = el.offsetHeight || 72;
    const gap = 14;
    const pad = 4;

    const spaceRight = plotW - anchorX - pad;
    const spaceLeft = anchorX - pad;
    const preferRight = spaceRight >= tipW + gap || spaceRight >= spaceLeft;
    let left = preferRight ? anchorX + gap : anchorX - tipW - gap;
    left = Math.min(Math.max(pad, left), Math.max(pad, plotW - tipW - pad));

    const preferAbove = anchorY - pad >= tipH + gap;
    let top = preferAbove ? anchorY - tipH - gap : anchorY + gap;
    top = Math.min(Math.max(pad, top), Math.max(pad, plotH - tipH - pad));

    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.opacity = "1";
  };

  /**
   * 표시 데이터 지점(시리즈 샘플 · 막대 · 히스토그램 끝)에만 히트.
   * 빈 플롯 영역 X스냅은 하지 않음.
   */
  const findDataPointHit = (
    xPx: number,
    yPx: number,
    plotW: number,
    plotH: number,
  ): { idx: number; xView: number; yView: number; seriesKey: string } | null => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const hitR = Math.max(12, markerRadiusPx * 3.8);
    const hitR2 = hitR * hitR;
    let bestD2 = hitR2;
    let best: {
      idx: number;
      xView: number;
      yView: number;
      seriesKey: string;
    } | null = null;

    const consider = (
      i: number,
      xView: number,
      yView: number,
      seriesKey: string,
    ) => {
      const sx = (xView / VIEW_W) * plotW;
      const sy = (yView / chartH) * plotH;
      const dx = xPx - sx;
      const dy = yPx - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { idx: i, xView, yView, seriesKey };
      }
    };

    if (mode === "bar") {
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          const yTop = yFor(v, axis);
          const baseY = PAD_TOP + innerH;
          const gx = xForBar(i) - barSlotW / 2 + si * barW;
          const barWv = Math.max(0.4, barW * 0.92);
          const left = (gx / VIEW_W) * plotW;
          const right = ((gx + barWv) / VIEW_W) * plotW;
          const top = (yTop / chartH) * plotH;
          const bottom = (baseY / chartH) * plotH;
          if (xPx >= left && xPx <= right && yPx >= top && yPx <= bottom) {
            consider(i, gx + barWv / 2, yTop, s.name);
            continue;
          }
          consider(i, gx + barWv / 2, yTop, s.name);
        }
      }
    } else {
      for (const s of series) {
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          consider(i, xFor(i), yFor(v, axis), s.name);
        }
      }
    }

    for (let hi = 0; hi < histograms.length; hi++) {
      const h = histograms[hi]!;
      const key = h.legendLabel ?? `hist-${hi}`;
      for (let i = 0; i < n; i++) {
        const v = h.values[i];
        if (v == null || !Number.isFinite(v)) continue;
        consider(i, xAtIndex(i), yFor(v, "left"), key);
      }
    }

    return best;
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    /** 십자선 — 플롯 위에서는 마우스 기준 항상 표시 */
    const xView = Math.min(
      VIEW_W - PAD_X,
      Math.max(PAD_X, (xPx / rect.width) * VIEW_W),
    );
    const yView = Math.min(
      PAD_TOP + innerH,
      Math.max(PAD_TOP, (yPx / rect.height) * chartH),
    );
    setCrosshairAt(xView, yView);

    const hit = findDataPointHit(xPx, yPx, rect.width, rect.height);
    if (!hit) {
      if (hoverIdxRef.current != null || hoverSeriesRef.current != null) {
        hoverIdxRef.current = null;
        hoverSeriesRef.current = null;
        setHoverIdx(null);
        setHoverSeries(null);
      }
      return;
    }
    const anchorX = (hit.xView / VIEW_W) * rect.width;
    const anchorY = (hit.yView / chartH) * rect.height;
    lastAnchorRef.current = {
      x: anchorX,
      y: anchorY,
      w: rect.width,
      h: rect.height,
    };
    placeTipNear(anchorX, anchorY, rect.width, rect.height);
    const same =
      hit.idx === hoverIdxRef.current &&
      hit.seriesKey === hoverSeriesRef.current;
    if (same) return;
    hoverIdxRef.current = hit.idx;
    hoverSeriesRef.current = hit.seriesKey;
    setHoverIdx(hit.idx);
    setHoverSeries(hit.seriesKey);
  };

  const clearHover = () => {
    hoverIdxRef.current = null;
    hoverSeriesRef.current = null;
    setHoverIdx(null);
    setHoverSeries(null);
    setCrosshairVisible(false);
  };

  useLayoutEffect(() => {
    if (hoverIdx == null) return;
    const a = lastAnchorRef.current;
    placeTipNear(a.x, a.y, a.w, a.h);
  }, [hoverIdx]);

  const markerStride =
    markerDensity === "sparse" ? Math.max(1, Math.ceil(n / 8)) : 1;
  const shouldShowMarker = (i: number) => {
    if (markerDensity === "all") return true;
    if (i === 0 || i === n - 1) return true;
    return i % markerStride === 0;
  };

  const autoTick = tickEvery ?? Math.max(1, Math.ceil(n / 5));
  const tickIndices = useMemo(() => {
    if (n <= 0) return [] as number[];
    if (n === 1) return [0];

    const every = Math.max(1, autoTick);
    const candidates: number[] = [];
    for (let i = 0; i < n; i += every) candidates.push(i);
    if (candidates[candidates.length - 1] !== n - 1) {
      candidates.push(n - 1);
    }

    // 라벨 폭을 고려한 최소 간격 — 끝점과 직전이 붙으면 끝점을 남기고 직전 제거
    const minGap = Math.max(every, Math.ceil(n / 5));
    const out: number[] = [candidates[0]!];
    for (let k = 1; k < candidates.length; k++) {
      const idx = candidates[k]!;
      const prev = out[out.length - 1]!;
      const isLast = k === candidates.length - 1;
      if (idx - prev >= minGap) {
        out.push(idx);
      } else if (isLast) {
        out[out.length - 1] = idx;
      }
    }
    return out;
  }, [autoTick, n]);

  /** 알람/한계 점선 — 동일 axis·밴드 1회. */
  const uniqueAlarmBands = useMemo(() => {
    const seen = new Set<string>();
    const out: { band: Band; axis: TrendAxis }[] = [];
    for (const s of series) {
      if (!s.band) continue;
      const axis = s.axis ?? "left";
      const key = `${axis}:${s.band.lo}:${s.band.hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ band: s.band, axis });
    }
    return out;
  }, [series]);

  /** referenceLines 중 알람 band 모서리와 중복되는 점선 제거. */
  const dedupedReferenceLines = useMemo(() => {
    if (uniqueAlarmBands.length === 0) return referenceLines;
    return referenceLines.filter((ref) => {
      const axis = ref.axis ?? "left";
      return !uniqueAlarmBands.some(
        ({ band, axis: bandAxis }) =>
          bandAxis === axis &&
          (Math.abs(band.lo - ref.value) < 1e-6 ||
            Math.abs(band.hi - ref.value) < 1e-6),
      );
    });
  }, [referenceLines, uniqueAlarmBands]);

  const unitForAxis = (axis: TrendAxis) =>
    axis === "right" ? rightUnit : leftUnit;

  /**
   * 한계(점선) 끝단 라벨
   * - 단일 Y: 좌끝 / 이중 Y: 축별 좌·우끝 (상한 위선·하한 아래선)
   */
  const edgeBandLabels = useMemo(() => {
    if (mode !== "line") return [] as EdgeBandLabel[];
    const out: EdgeBandLabel[] = [];
    const seriesColorForAxis = (axis: TrendAxis): string | null => {
      const match = series.find((s) => (s.axis ?? "left") === axis);
      return match?.color ?? null;
    };
    const sideForLimit = (axis: TrendAxis): "left" | "right" => {
      if (usesRight) return axis === "right" ? "right" : "left";
      return "left";
    };
    const colorForLimit = (axis: TrendAxis): string => {
      if (usesRight) {
        return seriesColorForAxis(axis) ?? SEV_COLOR.warning;
      }
      return SEV_COLOR.warning;
    };
    uniqueAlarmBands.forEach(({ band, axis }, idx) => {
      const unit = unitForAxis(axis);
      const side = sideForLimit(axis);
      const color = colorForLimit(axis);
      for (const edge of ["hi", "lo"] as const) {
        const value = band[edge];
        const y = yFor(value, axis);
        if (!Number.isFinite(y)) continue;
        out.push({
          id: `alarm-${idx}-${axis}-${edge}-${value}`,
          side,
          topPct: (y / chartH) * 100,
          text: formatTrendBandEdge(value, unit),
          color,
          title: `한계 ${edge === "hi" ? "상한" : "하한"}`,
          mark: edge === "hi" ? "overline" : "underline",
        });
      }
    });
    for (const ref of dedupedReferenceLines) {
      if (ref.hideLabel) continue;
      const axis = ref.axis ?? "left";
      const y = yFor(ref.value, axis);
      if (!Number.isFinite(y)) continue;
      const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
      const mid = (mn + mx) / 2;
      out.push({
        id: `ref-${axis}-${ref.value}`,
        side: sideForLimit(axis),
        topPct: (y / chartH) * 100,
        text:
          ref.label?.trim() ||
          formatTrendBandEdge(ref.value, unitForAxis(axis)),
        color: usesRight
          ? seriesColorForAxis(axis) ?? ref.color
          : ref.color,
        title: "한계",
        mark: ref.value >= mid ? "overline" : "underline",
      });
    }
    for (const guide of scaleEdgeLabels) {
      const axis = guide.axis ?? "left";
      const y = yFor(guide.value, axis);
      if (!Number.isFinite(y)) continue;
      out.push({
        id: guide.id,
        side: guide.side ?? "right",
        topPct: (y / chartH) * 100,
        text: guide.text,
        color: guide.color,
        title: guide.title ?? guide.text,
        mark: guide.mark,
      });
    }
    return nudgeEdgeLabelTops(out, 5.5);
    // yFor/chartH are stable for given domains+height
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yFor closes over domain/size
  }, [
    mode,
    usesRight,
    series,
    uniqueAlarmBands,
    dedupedReferenceLines,
    scaleEdgeLabels,
    leftUnit,
    rightUnit,
    chartH,
    lMin,
    lMax,
    rMin,
    rMax,
    innerH,
  ]);

  if (!hasAny || n === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  /** Build polyline segments, breaking on null (gap shading). */
  const lineSegments = (s: TrendSeries): string[] => {
    const axis = s.axis ?? "left";
    const segs: string[] = [];
    let cur: string[] = [];
    s.data.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
        return;
      }
      cur.push(`${xFor(i).toFixed(2)},${yFor(v, axis).toFixed(2)}`);
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  };

  /** 결측 구간 — 기준 시리즈(온도 우선) null 연속, 없으면 전 시리즈 null. */
  const nullGapRanges: { i0: number; i1: number }[] = [];
  if (showNullGaps && mode === "line" && series.length > 0) {
    const ref =
      series.find((s) => s.name === "온도" || s.name.startsWith("온도")) ??
      series[0]!;
    let start: number | null = null;
    const isGapAt = (i: number) => {
      const v = ref.data[i];
      return v == null || !Number.isFinite(v);
    };
    const flush = (end: number) => {
      if (start == null) return;
      if (end - start + 1 >= 2) nullGapRanges.push({ i0: start, i1: end });
      start = null;
    };
    for (let i = 0; i < n; i++) {
      if (isGapAt(i)) {
        if (start == null) start = i;
      } else {
        flush(i - 1);
      }
    }
    flush(n - 1);
  }

  const envelopePath = (env: TrendEnvelope): string | null => {
    const axis = env.axis ?? "left";
    const len = Math.min(env.high.length, env.low.length, n);
    if (len < 2) return null;
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i < len; i++) {
      const hi = env.high[i];
      const lo = env.low[i];
      if (
        hi == null ||
        lo == null ||
        !Number.isFinite(hi) ||
        !Number.isFinite(lo)
      ) {
        continue;
      }
      top.push(`${xFor(i).toFixed(2)},${yFor(hi, axis).toFixed(2)}`);
      bot.push(`${xFor(i).toFixed(2)},${yFor(lo, axis).toFixed(2)}`);
    }
    if (top.length < 2) return null;
    return `M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`;
  };

  return (
    <div className={showLegend ? "space-y-1.5" : "space-y-1"}>
      {showLegend ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block w-3 border-t-2"
              style={{
                borderColor: s.color,
                borderStyle: s.strokeDasharray
                  ? s.strokeDasharray.startsWith("2")
                    ? "dotted"
                    : "dashed"
                  : "solid",
              }}
              aria-hidden
            />
            {s.name}
            {(s.axis ?? "left") === "right" && usesRight ? <span className="opacity-60">(우)</span> : null}
          </span>
        ))}
        {envelopes.map((env, idx) =>
          env.legendLabel ? (
            <span
              key={`env-leg-${idx}`}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{
                  backgroundColor: env.fill,
                  opacity: Math.min(1, (env.fillOpacity ?? 0.22) * 2),
                }}
                aria-hidden
              />
              {env.legendLabel}
            </span>
          ) : null,
        )}
        {histograms.map((h, idx) =>
          h.legendLabel ? (
            <span
              key={`hist-leg-${idx}`}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              {h.style === "volume" ? (
                <span
                  className="inline-block h-2 w-3 rounded-sm"
                  style={{ backgroundColor: h.colorUp, opacity: 0.85 }}
                  aria-hidden
                />
              ) : (
                <span
                  className="inline-flex h-2 w-3 overflow-hidden rounded-sm"
                  aria-hidden
                >
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: h.colorUp }}
                  />
                  <span
                    className="h-full w-1/2"
                    style={{ backgroundColor: h.colorDown }}
                  />
                </span>
              )}
              {h.legendLabel}
            </span>
          ) : null,
        )}
      </div>
      ) : null}

      <div
        ref={plotRef}
        className="relative cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={clearHover}
      >
      <svg
        viewBox={`0 0 ${VIEW_W} ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
        role="img"
        aria-label="추이 차트"
      >
        <defs>
          <filter
            id={glowFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.35" />
          </filter>
        </defs>
        <g className={enterMotion ? motionClass.farmChartPlotReveal : undefined}>
        {nullGapRanges.map((g) => {
          const x0 = xFor(g.i0);
          const x1 = xFor(g.i1);
          const slot =
            n > 1 ? (VIEW_W - 2 * PAD_X) / (n - 1) : VIEW_W - 2 * PAD_X;
          const left = Math.max(PAD_X, x0 - slot / 2);
          const right = Math.min(VIEW_W - PAD_X, x1 + slot / 2);
          return (
            <rect
              key={`null-gap-${g.i0}-${g.i1}`}
              x={left}
              y={PAD_TOP}
              width={Math.max(0.4, right - left)}
              height={innerH}
              fill="#64748b"
              fillOpacity={0.18}
              stroke="none"
            />
          );
        })}
        {mode === "line"
          ? histograms.map((h, hi) => {
              const yBase = yFor(h.baseline, "left");
              const slot =
                n > 1 ? (VIEW_W - 2 * PAD_X) / (n - 1) : VIEW_W - 2 * PAD_X;
              const isVolume = h.style === "volume";
              const isOverlay = h.style === "overlay";
              const gs = Math.max(1, h.groupSize ?? 1);
              const gi = h.groupIndex ?? 0;
              const barWHist = Math.max(
                0.22,
                slot *
                  (isVolume && gs > 1
                    ? 0.62 / gs
                    : isVolume
                      ? 0.5
                      : isOverlay
                        ? 0.28
                        : 0.55),
              );
              const cluster =
                isVolume && gs > 1
                  ? (gi - (gs - 1) / 2) * (barWHist + 0.12)
                  : 0;
              const opacity = h.fillOpacity ?? (isOverlay ? 0.14 : isVolume ? 0.7 : 0.75);
              return (
                <g key={`hist-${hi}`}>
                  {(!isVolume || gi === 0) && !isOverlay ? (
                    <line
                      x1={PAD_X}
                      x2={VIEW_W - PAD_X}
                      y1={yBase}
                      y2={yBase}
                      stroke="#94a3b8"
                      strokeWidth={0.4}
                      strokeDasharray={isVolume ? "1 2" : "1.5 1.5"}
                      vectorEffect="non-scaling-stroke"
                      opacity={isVolume ? 0.35 : 0.5}
                    />
                  ) : null}
                  {isOverlay ? (
                    <line
                      x1={PAD_X}
                      x2={VIEW_W - PAD_X}
                      y1={yBase}
                      y2={yBase}
                      stroke="#f87171"
                      strokeWidth={0.55}
                      strokeDasharray="3 2.5"
                      vectorEffect="non-scaling-stroke"
                      opacity={0.55}
                    />
                  ) : null}
                  {h.values.map((v, i) => {
                    if (v == null || !Number.isFinite(v)) return null;
                    const yVal = yFor(v, "left");
                    const top = Math.min(yBase, yVal);
                    const height = Math.max(0.35, Math.abs(yVal - yBase));
                    const up = v >= h.baseline;
                    const barOp =
                      h.fillOpacityValues?.[i] != null &&
                      Number.isFinite(h.fillOpacityValues[i]!)
                        ? (h.fillOpacityValues[i] as number)
                        : opacity;
                    return (
                      <rect
                        key={`hist-${hi}-${i}`}
                        x={xFor(i) + cluster - barWHist / 2}
                        y={top}
                        width={barWHist}
                        height={height}
                        fill={
                          isVolume || up ? h.colorUp : h.colorDown
                        }
                        fillOpacity={barOp}
                        stroke="none"
                      />
                    );
                  })}
                </g>
              );
            })
          : null}
        {mode === "line"
          ? envelopes.map((env, idx) => {
              const d = envelopePath(env);
              if (!d) return null;
              return (
                <path
                  key={`env-${idx}`}
                  d={d}
                  fill={env.fill}
                  fillOpacity={env.fillOpacity ?? 0.22}
                  stroke="none"
                  className={
                    enterMotion ? motionClass.farmChartEnvelopeIn : undefined
                  }
                />
              );
            })
          : null}

        {mode === "line"
          ? uniqueAlarmBands.map(({ band, axis }, idx) => {
              const yTop = yFor(band.hi, axis);
              const yBot = yFor(band.lo, axis);
              return (
                <g key={`alarm-${idx}`}>
                  <line
                    x1={PAD_X}
                    x2={VIEW_W - PAD_X}
                    y1={yTop}
                    y2={yTop}
                    stroke={SEV_COLOR.warning}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    strokeOpacity={0.65}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={PAD_X}
                    x2={VIEW_W - PAD_X}
                    y1={yBot}
                    y2={yBot}
                    stroke={SEV_COLOR.warning}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    strokeOpacity={0.65}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })
          : null}

        {dedupedReferenceLines.map((ref, idx) => {
          const y = yFor(ref.value, ref.axis ?? "left");
          if (!Number.isFinite(y)) return null;
          return (
            <line
              key={`ref-${idx}`}
              x1={PAD_X}
              x2={VIEW_W - PAD_X}
              y1={y}
              y2={y}
              stroke={ref.color}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
              vectorEffect="non-scaling-stroke"
              opacity={0.7}
            />
          );
        })}

        {scaleEdgeLabels
          .filter((g) => g.showLine)
          .map((guide) => {
            const y = yFor(guide.value, guide.axis ?? "left");
            if (!Number.isFinite(y)) return null;
            return (
              <line
                key={`scale-guide-${guide.id}`}
                x1={PAD_X}
                x2={VIEW_W - PAD_X}
                y1={y}
                y2={y}
                stroke={guide.color}
                strokeWidth={0.45}
                strokeDasharray="1.5 2"
                vectorEffect="non-scaling-stroke"
                opacity={0.55}
              />
            );
          })}

        {mode === "bar"
          ? series.map((s, si) =>
              s.data.map((v, i) => {
                if (v == null || !Number.isFinite(v)) return null;
                const axis = s.axis ?? "left";
                const yTop = yFor(v, axis);
                const baseY = PAD_TOP + innerH;
                const gx = xForBar(i) - barSlotW / 2 + si * barW;
                return (
                  <rect
                    key={`${s.name}-${i}`}
                    x={gx}
                    y={yTop}
                    width={Math.max(0.4, barW * 0.92)}
                    height={Math.max(0, baseY - yTop)}
                    fill={s.color}
                    opacity={hoverIdx === i ? 1 : 0.85}
                  />
                );
              }),
            )
          : series.map((s, si) => {
              const axis = s.axis ?? "left";
              const segs = lineSegments(s);
              const focused =
                hoverSeries == null || hoverSeries === s.name;
              const lineOpacity = focused ? 1 : 0.22;
              const strokeW = focused && hoverSeries ? 1.85 : 1.55;
              return (
                <g
                  key={s.name}
                  style={{
                    opacity: lineOpacity,
                    transition: "opacity 120ms linear",
                  }}
                >
                  {segs.map((pts, idx) => (
                    <g key={idx}>
                      {!s.strokeDasharray ? (
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={strokeW + 2.2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          filter={`url(#${glowFilterId})`}
                          className={motionClass.farmChartLineGlow}
                          opacity={focused ? 0.35 : 0.08}
                        />
                      ) : null}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={strokeW}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray={s.strokeDasharray}
                        vectorEffect="non-scaling-stroke"
                        className={
                          enterMotion
                            ? motionClass.farmChartLineSoftIn
                            : undefined
                        }
                      />
                    </g>
                  ))}
                  {showMarkers
                    ? s.data.map((v, i) => {
                        if (v == null || !Number.isFinite(v)) return null;
                        if (!shouldShowMarker(i)) return null;
                        const cx = xFor(i);
                        const cy = yFor(v, axis);
                        const rPx = markerRadiusPx;
                        const markerDelayMs = enterMotion
                          ? 120 +
                            si * motionStaggerStepMs +
                            Math.min(i, 8) * 16
                          : 0;
                        const markerStyle = enterMotion
                          ? ({
                              ["--farm-chart-marker-delay" as string]:
                                `${markerDelayMs}ms`,
                            } as CSSProperties)
                          : undefined;
                        const markerClass = enterMotion
                          ? motionClass.farmChartMarkerPop
                          : undefined;
                        if (s.band) {
                          const sev = sevOfScore(severityScore(v, s.band));
                          if (sev !== "normal") {
                            return (
                              <ellipse
                                key={`${s.name}-sev-${i}`}
                                cx={cx}
                                cy={cy}
                                rx={markerRx(rPx)}
                                ry={markerRy(rPx)}
                                fill={SEV_COLOR[sev]}
                                className={markerClass}
                                style={markerStyle}
                              />
                            );
                          }
                        }
                        return (
                          <ellipse
                            key={`${s.name}-dot-${i}`}
                            cx={cx}
                            cy={cy}
                            rx={markerRx(rPx)}
                            ry={markerRy(rPx)}
                            fill={s.color}
                            className={markerClass}
                            style={markerStyle}
                          />
                        );
                      })
                    : null}
                </g>
              );
            })}

        {/* 호버 강조 — 링 펄스 + 코어 */}
        {mode === "line" && hoverIdx != null && hoverIdx >= 0 && hoverIdx < n
          ? series.map((s) => {
              const v = s.data[hoverIdx];
              if (v == null || !Number.isFinite(v)) return null;
              const axis = s.axis ?? "left";
              const isFocus = hoverSeries == null || hoverSeries === s.name;
              if (!isFocus) return null;
              const cx = xFor(hoverIdx);
              const cy = yFor(v, axis);
              return (
                <g key={`hover-${s.name}`}>
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 5)}
                    ry={markerRy(markerRadiusPx + 5)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.1}
                    vectorEffect="non-scaling-stroke"
                    className={motionClass.farmChartHoverRing}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 1.8)}
                    ry={markerRy(markerRadiusPx + 1.8)}
                    fill={s.color}
                    opacity={0.98}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx * 0.45)}
                    ry={markerRy(markerRadiusPx * 0.45)}
                    fill="#fff"
                    opacity={0.9}
                  />
                </g>
              );
            })
          : null}
        </g>

        {/* 마우스 기준 회색 십자선 — DOM 직접 갱신(리렌더 최소화) */}
        <line
          ref={crossVRef}
          x1={PAD_X}
          x2={PAD_X}
          y1={PAD_TOP}
          y2={PAD_TOP + innerH}
          stroke="#94a3b8"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          style={{ opacity: 0, transition: "opacity 90ms linear" }}
          pointerEvents="none"
        />
        <line
          ref={crossHRef}
          x1={PAD_X}
          x2={VIEW_W - PAD_X}
          y1={PAD_TOP}
          y2={PAD_TOP}
          stroke="#94a3b8"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          style={{ opacity: 0, transition: "opacity 90ms linear" }}
          pointerEvents="none"
        />
      </svg>

      {edgeBandLabels.map((label) => (
        <span
          key={label.id}
          className={cn(
            "pointer-events-none absolute z-[1] -translate-y-1/2 rounded-sm bg-background/85 px-0.5 text-[9px] leading-none tabular-nums",
            label.side === "left" && "left-0.5 text-left",
            label.side === "right" && "right-0.5 text-right",
            label.mark === "overline" && "border-t border-current pt-px",
            label.mark === "underline" && "border-b border-current pb-px",
          )}
          style={{ top: `${label.topPct}%`, color: label.color }}
          title={label.title}
        >
          {label.text}
        </span>
      ))}

      {hoverIdx != null && hoverIdx >= 0 && hoverIdx < n ? (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[11.5rem]"
          style={{ opacity: 0, willChange: "transform" }}
          aria-live="polite"
          data-tour-id="trend-chart-hover-card"
        >
          <div
            className={cn(
              "rounded-md border border-border/80 bg-popover/95 px-2 py-1.5 text-popover-foreground shadow-lg backdrop-blur-sm",
              motionClass.farmChartTipIn,
            )}
          >
          <div className="mb-1 text-[10px] font-semibold">
            {categories[hoverIdx]}
          </div>
          <div className="space-y-0.5">
            {series.map((s) => {
              const v = s.data[hoverIdx];
              const unit =
                (s.axis ?? "left") === "right" ? rightUnit : leftUnit;
              const sec = s.hoverSecondary?.[hoverIdx];
              const mappedPrimary =
                v == null || !Number.isFinite(v)
                  ? "–"
                  : formatTrendHoverValue(v, unit, s.name);
              const display =
                sec != null &&
                Number.isFinite(sec) &&
                s.hoverSecondaryUnit
                  ? formatTrendHoverValue(sec, s.hoverSecondaryUnit, s.name)
                  : mappedPrimary;
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2 text-[10px]"
                  style={{
                    opacity:
                      hoverSeries && hoverSeries !== s.name ? 0.42 : 1,
                    fontWeight:
                      hoverSeries && hoverSeries === s.name ? 600 : undefined,
                  }}
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {display}
                  </span>
                </div>
              );
            })}
            {histograms.map((h, hi) => {
              const sec = h.hoverSecondary?.[hoverIdx];
              const chartV = h.values[hoverIdx];
              const up =
                chartV != null && Number.isFinite(chartV)
                  ? chartV >= h.baseline
                  : true;
              let display = "–";
              if (sec != null && Number.isFinite(sec) && h.hoverSecondaryUnit) {
                if (h.hoverFormat === "midpointDelta") {
                  display = `중점 ${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
                } else if (
                  h.hoverFormat === "percent" ||
                  h.style === "volume" ||
                  h.hoverSecondaryUnit === "%"
                ) {
                  display = `${Math.round(sec)}${h.hoverSecondaryUnit}`;
                } else {
                  display = `${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
                }
              }
              return (
                <div
                  key={`hist-tip-${hi}`}
                  className="flex items-center justify-between gap-2 text-[10px]"
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        backgroundColor:
                          h.style === "volume" || up
                            ? h.colorUp
                            : h.colorDown,
                      }}
                    />
                    <span className="truncate">{h.legendLabel ?? "편차"}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
          {uniqueAlarmBands.length > 0 ? (
            <div className="mt-1 space-y-0.5 border-t border-border/60 pt-1">
              {uniqueAlarmBands.map(({ band, axis }, idx) => {
                const unit = unitForAxis(axis);
                const tipColor = usesRight
                  ? series.find((s) => (s.axis ?? "left") === axis)?.color ??
                    SEV_COLOR.warning
                  : SEV_COLOR.warning;
                return (
                  <div
                    key={`tip-alarm-${idx}`}
                    className="flex items-center justify-between gap-2 text-[9px]"
                    style={{ color: tipColor }}
                  >
                    <span>
                      한계
                      {usesRight
                        ? axis === "right"
                          ? "(우)"
                          : "(좌)"
                        : ""}
                    </span>
                    <span className="tabular-nums">
                      {formatTrendBandEdge(band.lo, unit)}–
                      {formatTrendBandEdge(band.hi, unit)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
      </div>

      <div className="relative h-4 overflow-hidden border-t pt-1">
        {tickIndices.map((i) => {
          const fullLabel = categories[i] ?? "";
          if (!fullLabel) return null;
          const endpoint = i === 0 || i === n - 1;
          const label = period
            ? abbreviateTrendAxisLabel(period, fullLabel, { endpoint })
            : fullLabel;
          const align =
            i === 0 ? "left" : i === n - 1 ? "right" : "center";
          return (
            <span
              key={`tick-${i}-${fullLabel}`}
              className={cn(
                "pointer-events-none absolute top-1 text-[9px] leading-none text-muted-foreground",
                align === "left" && "left-0 max-w-[30%] truncate text-left",
                align === "right" && "right-0 max-w-[30%] truncate text-right",
                align === "center" &&
                  "max-w-[22%] -translate-x-1/2 truncate text-center",
              )}
              style={
                align === "center"
                  ? { left: `${(xAtIndex(i) / VIEW_W) * 100}%` }
                  : undefined
              }
              title={fullLabel}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
