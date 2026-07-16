"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
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
  /** 알람/환기 밴드 — fill + 주의·경고 마커 (MetricLineChart와 동일). */
  band?: Band | null;
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
  emptyLabel?: string;
  /** Show every Nth category tick (auto if omitted). */
  tickEvery?: number;
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
  emptyLabel = "데이터 없음",
  tickEvery,
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

  const autoTick = tickEvery ?? Math.max(1, Math.ceil(n / 6));
  const showTick = (i: number) => i === 0 || i === n - 1 || i % autoTick === 0;

  /** 동일 axis·밴드는 한 번만 fill (채널 A/B/C 중복 방지). */
  const uniqueBands = useMemo(() => {
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

  return (
    <div className={showLegend ? "space-y-1.5" : "space-y-1"}>
      {showLegend ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
            {(s.axis ?? "left") === "right" && usesRight ? <span className="opacity-60">(우)</span> : null}
          </span>
        ))}
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
          ? uniqueBands.map(({ band, axis }, idx) => {
              const yTop = yFor(band.hi, axis);
              const yBot = yFor(band.lo, axis);
              return (
                <g key={`band-${idx}`}>
                  <rect
                    x={PAD_X}
                    y={yTop}
                    width={innerW}
                    height={Math.max(0, yBot - yTop)}
                    fill={SEV_COLOR.normal}
                    fillOpacity={0.1}
                  />
                  <line
                    x1={PAD_X}
                    x2={VIEW_W - PAD_X}
                    y1={yTop}
                    y2={yTop}
                    stroke={SEV_COLOR.warning}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    strokeOpacity={0.5}
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
                    strokeOpacity={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })
          : null}

        {referenceLines.map((ref, idx) => {
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
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {s.data.map((v, i) => {
                    if (v == null || !Number.isFinite(v)) return null;
                    const cx = xFor(i);
                    const cy = yFor(v, axis);
                    if (s.band) {
                      const sev = sevOfScore(severityScore(v, s.band));
                      if (sev === "normal") return null;
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

      {hover && hover.idx >= 0 && hover.idx < n ? (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-2 py-1 text-popover-foreground shadow-md"
          style={{ left: Math.min(Math.max(hover.xPx - 64, 2), Math.max(2, hover.w - 130)), width: 128 }}
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
                    {v == null || !Number.isFinite(v) ? "–" : `${v}${unit}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      </div>

      {mode === "bar" && barCenterCluster ? (
        <div className="relative h-3.5 border-t pt-1">
          {categories.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[9px] leading-none text-muted-foreground"
              style={{ left: `${(xForBar(i) / VIEW_W) * 100}%` }}
            >
              {showTick(i) ? label : ""}
            </span>
          ))}
        </div>
      ) : (
        <div className={cn("flex w-full gap-px border-t pt-1")}>
          {categories.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className={cn(
                "min-w-0 flex-1 overflow-visible whitespace-nowrap text-[9px] leading-none text-muted-foreground",
                i === 0 ? "text-left" : i === n - 1 ? "text-right" : "text-center",
              )}
            >
              {showTick(i) ? label : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
