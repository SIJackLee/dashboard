"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TrendAxis = "left" | "right";

export type TrendSeries = {
  name: string;
  data: (number | null)[];
  /** Hex color for line/bar/legend. */
  color: string;
  axis?: TrendAxis;
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
}: TrendChartProps) {
  const [hover, setHover] = useState<{ idx: number; xPx: number; w: number } | null>(null);
  const hasAny = series.some((s) => s.data?.some((v) => v != null));
  const n = categories.length;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, rect.width > 0 ? xPx / rect.width : 0));
    setHover({ idx: Math.round(ratio * (n - 1)), xPx, w: rect.width });
  };

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

  const autoTick = tickEvery ?? Math.max(1, Math.ceil(n / 6));
  const showTick = (i: number) => i === 0 || i === n - 1 || i % autoTick === 0;

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

  const barGroupW = n > 0 ? innerW / n : innerW;
  const barSlotW = barGroupW * 0.7;
  const barW = series.length > 0 ? barSlotW / series.length : barSlotW;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
            {(s.axis ?? "left") === "right" && usesRight ? <span className="opacity-60">(우)</span> : null}
          </span>
        ))}
      </div>

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
                const gx = xFor(i) - barSlotW / 2 + si * barW;
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
                  {s.data.map((v, i) =>
                    v != null && Number.isFinite(v) ? (
                      <circle
                        key={`${s.name}-dot-${i}`}
                        cx={xFor(i)}
                        cy={yFor(v, axis)}
                        r={hover && hover.idx === i ? 1.8 : 0.9}
                        fill={s.color}
                      />
                    ) : null,
                  )}
                </g>
              );
            })}

        {hover && hover.idx >= 0 && hover.idx < n ? (
          <line
            x1={xFor(hover.idx)}
            x2={xFor(hover.idx)}
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
    </div>
  );
}
