"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { abbreviateTrendAxisLabel } from "@/lib/farm/trend-display-buckets";
import {
  type Band,
  SEV_COLOR,
  sevOfScore,
  severityScore,
} from "@/lib/farm/severity-score";

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

export type TrendReferenceLine = {
  value: number;
  axis?: TrendAxis;
  color: string;
  label?: string;
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
  /** line 모드 — 시리즈 아래 면 채우기(클라우드·밴드). */
  envelopes?: TrendEnvelope[];
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
  envelopes = [],
  emptyLabel = "데이터 없음",
  tickEvery,
  period,
  barWidthCapPct,
  showLegend = true,
}: TrendChartProps) {
  const [hover, setHover] = useState<{ idx: number; xPx: number; w: number } | null>(null);
  const hasAny = series.some((s) => s.data?.some((v) => v != null));
  const n = categories.length;

  const axisH = 16;
  const chartH = height - axisH;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = chartH - PAD_TOP * 2;

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

  const hoverIndexAtRatio = (ratio: number): number => {
    if (mode === "bar" && barCenterCluster) {
      const xView = PAD_X + ratio * innerW;
      let idx = 0;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(xForBar(i) - xView);
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      return idx;
    }
    return Math.round(ratio * (n - 1));
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, rect.width > 0 ? xPx / rect.width : 0));
    setHover({ idx: hoverIndexAtRatio(ratio), xPx, w: rect.width });
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
    return nudgeEdgeLabelTops(out, 7);
    // yFor/chartH are stable for given domains+height
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yFor closes over domain/size
  }, [
    mode,
    usesRight,
    series,
    uniqueAlarmBands,
    dedupedReferenceLines,
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
      </div>
      ) : null}

      <div
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
      <svg
        viewBox={`0 0 ${VIEW_W} ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
        role="img"
        aria-label="추이 차트"
      >
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
                    opacity={hover && hover.idx === i ? 1 : 0.85}
                  />
                );
              }),
            )
          : series.map((s) => {
              const axis = s.axis ?? "left";
              const segs = lineSegments(s);
              return (
                <g key={s.name}>
                  {segs.map((pts, idx) => (
                    <polyline
                      key={idx}
                      points={pts}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={1.4}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={s.strokeDasharray}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {s.data.map((v, i) => {
                    if (v == null || !Number.isFinite(v)) return null;
                    const cx = xFor(i);
                    const cy = yFor(v, axis);
                    if (s.band) {
                      const sev = sevOfScore(severityScore(v, s.band));
                      if (sev !== "normal") {
                        return (
                          <circle
                            key={`${s.name}-sev-${i}`}
                            cx={cx}
                            cy={cy}
                            r={hover && hover.idx === i ? 2.4 : 2}
                            fill={SEV_COLOR[sev]}
                          />
                        );
                      }
                    }
                    return (
                      <circle
                        key={`${s.name}-dot-${i}`}
                        cx={cx}
                        cy={cy}
                        r={hover && hover.idx === i ? 1.8 : 0.9}
                        fill={s.color}
                      />
                    );
                  })}
                </g>
              );
            })}

        {hover && hover.idx >= 0 && hover.idx < n ? (
          <line
            x1={xAtIndex(hover.idx)}
            x2={xAtIndex(hover.idx)}
            y1={PAD_TOP}
            y2={PAD_TOP + innerH}
            stroke="currentColor"
            strokeWidth={0.5}
            strokeDasharray="1.5 1.5"
            vectorEffect="non-scaling-stroke"
            className="text-muted-foreground"
            opacity={0.5}
          />
        ) : null}
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

      {hover && hover.idx >= 0 && hover.idx < n ? (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-2 py-1 text-popover-foreground shadow-md"
          style={{ left: Math.min(Math.max(hover.xPx - 70, 2), Math.max(2, hover.w - 148)), width: 148 }}
        >
          <div className="mb-1 text-[10px] font-semibold">{categories[hover.idx]}</div>
          <div className="space-y-0.5">
            {series.map((s) => {
              const v = s.data[hover.idx];
              const unit = (s.axis ?? "left") === "right" ? rightUnit : leftUnit;
              return (
                <div key={s.name} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-medium tabular-nums">
                    {v == null || !Number.isFinite(v)
                      ? "–"
                      : formatTrendHoverValue(v, unit, s.name)}
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
                    <span>한계{usesRight ? (axis === "right" ? "(우)" : "(좌)") : ""}</span>
                    <span className="tabular-nums">
                      {formatTrendBandEdge(band.lo, unit)}–{formatTrendBandEdge(band.hi, unit)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
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
