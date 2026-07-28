"use client";

import { useMemo, useRef, useState } from "react";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import { downsampleTrendValues } from "@/lib/farm/trend-display-buckets";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/** 30d 컨텍스트 기준 — 우측(now) 정렬 윈도우 비율 */
const PERIOD_WINDOW: Record<TrendPeriodId, { start: number; width: number }> = {
  "30d": { start: 0, width: 1 },
  "7d": { start: 1 - 7 / 30, width: 7 / 30 },
  "24h": { start: 1 - 1 / 30, width: 1 / 30 },
};

const PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

function snapSpanToPeriod(span: number): TrendPeriodId {
  if (span <= 0.08) return "24h";
  if (span <= 0.35) return "7d";
  return "30d";
}

type Props = {
  period: TrendPeriodId;
  onPeriodChange: (period: TrendPeriodId) => void;
  /** 30d 시계열(가능하면) — 브러시 스파크라인 */
  overviewValues?: (number | null)[];
  className?: string;
};

/**
 * 통합 추이용 기간 브러시 — 프리셋 + 30d 컨텍스트 윈도우.
 * 드래그 폭에 따라 24h/7d/30d로 스냅(우측 now 정렬).
 */
export function UnifiedTrendPeriodBrush({
  period,
  onPeriodChange,
  overviewValues = [],
  className,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ a: number; b: number } | null>(null);
  const [draft, setDraft] = useState<{ a: number; b: number } | null>(null);

  const spark = useMemo(() => {
    if (overviewValues.length <= 60) return overviewValues;
    return downsampleTrendValues(overviewValues, 60);
  }, [overviewValues]);

  const win = PERIOD_WINDOW[period];
  const display = draft
    ? {
        start: Math.min(draft.a, draft.b),
        width: Math.max(0.02, Math.abs(draft.b - draft.a)),
      }
    : win;

  const ratioFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const commitDraft = (a: number, b: number) => {
    const left = Math.min(a, b);
    const span = Math.abs(b - a);
    let next: TrendPeriodId;
    if (span < 0.02) {
      // 클릭: 우측(now) 정렬 윈도우 중 해당 지점이 들어가는 최소 기간
      if (left >= PERIOD_WINDOW["24h"].start) next = "24h";
      else if (left >= PERIOD_WINDOW["7d"].start) next = "7d";
      else next = "30d";
    } else {
      next = snapSpanToPeriod(span);
    }
    onPeriodChange(next);
    setDraft(null);
    dragRef.current = null;
  };

  return (
    <div className={cn("space-y-1.5", className)} data-tour-id="unified-trend-period-brush">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="추이 기간">
        {PERIOD_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={period === id}
            onClick={() => onPeriodChange(id)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
              motionClass.microHover,
              period === id
                ? "border-sky-500/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                : "border-border bg-muted/20 text-muted-foreground",
            )}
          >
            {TREND_PERIODS[id].label}
          </button>
        ))}
        <span className="text-[0.6rem] text-muted-foreground">
          브러시 드래그 → 기간 스냅
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-9 select-none overflow-hidden rounded-md border bg-muted/30"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = ratioFromEvent(e.clientX);
          dragRef.current = { a: r, b: r };
          setDraft({ a: r, b: r });
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const r = ratioFromEvent(e.clientX);
          dragRef.current = { ...dragRef.current, b: r };
          setDraft({ a: dragRef.current.a, b: r });
        }}
        onPointerUp={(e) => {
          if (!dragRef.current) return;
          const r = ratioFromEvent(e.clientX);
          commitDraft(dragRef.current.a, r);
        }}
        onPointerCancel={() => {
          setDraft(null);
          dragRef.current = null;
        }}
        role="group"
        aria-label={`기간 브러시 · 현재 ${TREND_PERIODS[period].label}`}
      >
        <svg
          viewBox="0 0 100 36"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {spark.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const n = Math.max(1, spark.length);
            const x = (i / n) * 100;
            const w = Math.max(0.8, 100 / n - 0.3);
            const h = Math.max(2, (Math.min(100, Math.max(0, v)) / 100) * 28);
            return (
              <rect
                key={i}
                x={x}
                y={32 - h}
                width={w}
                height={h}
                fill="#f59e0b"
                opacity={0.45}
              />
            );
          })}
        </svg>

        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/50",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{ left: 0, width: `${display.start * 100}%` }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/50",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: `${(display.start + display.width) * 100}%`,
            right: 0,
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 rounded-sm border-2 border-sky-500 bg-sky-500/15",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: `${display.start * 100}%`,
            width: `${display.width * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
