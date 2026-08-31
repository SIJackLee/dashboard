/**
 * 추이 차트 순수 기하/스케일 헬퍼.
 *
 * React·DOM 의존이 없는 값 계산만 모아 `trend-chart.tsx`에서 분리한다.
 * (상호작용 훅·SVG 렌더러는 별도 모듈)
 */

import type {
  TrendAxis,
  TrendEnvelope,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/data/trend-chart-types";
import { inferHoverMetricGroup } from "./trend-chart-format";

/** view 좌표 매퍼 — 렌더 시점 도메인·크기에 닫힌 클로저를 주입받는다. */
type XForFn = (i: number) => number;
type YForFn = (value: number, axis: TrendAxis) => number;

/**
 * 시리즈를 polyline 세그먼트 문자열로. null/비유한 값에서 끊어 gap을 만든다.
 * (SVG `points` 좌표 계산 — 순수)
 */
export function buildLineSegments(
  s: TrendSeries,
  xFor: XForFn,
  yFor: YForFn,
): string[] {
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
}

/**
 * 엔벨로프(밴드)를 채움 path(`d`) 배열로. polys가 있으면 run별로, 없으면 high/low에서
 * 유효 구간을 이어 상단→하단 역순으로 닫는다. (순수)
 */
export function buildEnvelopePaths(
  env: TrendEnvelope,
  n: number,
  xFor: XForFn,
  yFor: YForFn,
): string[] {
  const axis = env.axis ?? "left";
  if (env.polys?.length) {
    const paths: string[] = [];
    for (const run of env.polys) {
      if (run.length < 2) continue;
      const top = run.map(
        (p) => `${xFor(p.x).toFixed(2)},${yFor(p.high, axis).toFixed(2)}`,
      );
      const bot = run.map(
        (p) => `${xFor(p.x).toFixed(2)},${yFor(p.low, axis).toFixed(2)}`,
      );
      paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
    }
    return paths;
  }
  const len = Math.min(env.high.length, env.low.length, n);
  if (len < 2) return [];
  const paths: string[] = [];
  let top: string[] = [];
  let bot: string[] = [];
  const flush = () => {
    if (top.length >= 2) {
      paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
    }
    top = [];
    bot = [];
  };
  for (let i = 0; i < len; i++) {
    const hi = env.high[i];
    const lo = env.low[i];
    if (
      hi == null ||
      lo == null ||
      !Number.isFinite(hi) ||
      !Number.isFinite(lo)
    ) {
      flush();
      continue;
    }
    top.push(`${xFor(i).toFixed(2)},${yFor(hi, axis).toFixed(2)}`);
    bot.push(`${xFor(i).toFixed(2)},${yFor(lo, axis).toFixed(2)}`);
  }
  flush();
  return paths;
}

export const PAD_X = 6;
export const PAD_TOP = 6;
/** 모터 0%를 회색 시간축에 붙임 — 하단 여백 없음 */
export const PAD_BOTTOM = 0;
/** 측정 전 fallback · 패딩 비율 기준 */
export const VIEW_W_NORM = 100;
export const X_SCOPE_DRAG_PX = 8;
export const X_SCOPE_MIN_SPAN = 3;
/** 알람 가이드선 hit (화면 px) */
export const SCALE_EDGE_HIT_PX = 10;
/** 라벨에서 드래그 시작까지 이동량 — 클릭과 구분 */
export const SCALE_EDGE_LABEL_DRAG_PX = 4;

export function parseScaleEdgeEditSeed(
  guide: Pick<TrendScaleEdgeLabel, "editValue" | "text">,
): string {
  if (guide.editValue != null && Number.isFinite(guide.editValue)) {
    return String(guide.editValue);
  }
  const m = guide.text.match(/-?\d+(?:\.\d+)?/);
  return m?.[0] ?? "";
}

/** `28.5℃` / `+5℃` / `100%` → 단위 접미 (`℃`, `%`) */
export function parseScaleEdgeValueUnit(text: string): string {
  const m = text.match(/-?\d+(?:\.\d+)?(.*)$/);
  return (m?.[1] ?? "").trim();
}

export function tipPinId(idx: number, seriesKey: string): string {
  const g = inferHoverMetricGroup(seriesKey);
  return `${idx}::${g}`;
}

/** 앵커 기준 카드 left/top (px) — 플롯 안·포인터 가리지 않게 */
export function computeTipPlacement(
  anchorX: number,
  anchorY: number,
  plotW: number,
  plotH: number,
  tipW = 168,
  tipH = 88,
): { left: number; top: number } {
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
  return { left: Math.round(left), top: Math.round(top) };
}

export type EdgeBandLabel = {
  id: string;
  side: "left" | "right" | "center" | "plotStart";
  /** 0~100, 차트 영역 기준 top % */
  topPct: number;
  text: string;
  leadingText?: string;
  color: string;
  title: string;
  /** 상한=숫자 위 선, 하한=숫자 아래 선 */
  mark?: "overline" | "underline";
  draggable?: boolean;
  editValue?: number;
  labelLane?: "outer" | "inner";
  showApplyActions?: boolean;
};

/** 같은 끝단에서 가까운 라벨을 위·아래로 살짝 밀어 겹침을 줄인다. */
export function nudgeEdgeLabelTops(
  labels: EdgeBandLabel[],
  minGapPct: number,
): EdgeBandLabel[] {
  const bySide: Record<
    "left" | "right" | "center" | "plotStart",
    EdgeBandLabel[]
  > = {
    left: [],
    right: [],
    center: [],
    plotStart: [],
  };
  for (const l of labels) bySide[l.side].push({ ...l });
  for (const side of ["left", "right", "center", "plotStart"] as const) {
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
  return [
    ...bySide.left,
    ...bySide.right,
    ...bySide.center,
    ...bySide.plotStart,
  ];
}

export function finiteValues(
  series: TrendSeries[],
  axis: TrendAxis | undefined,
): number[] {
  const out: number[] = [];
  for (const s of series) {
    if ((s.axis ?? "left") !== (axis ?? "left")) continue;
    for (const v of s.data) {
      if (v != null && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

export function domainFor(
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
