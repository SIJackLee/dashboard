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
 * TradingView형 기간 네비게이터 — 프리셋 + 30d 컨텍스트 윈도우.
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
    if (overviewValues.length <= 80) return overviewValues;
    return downsampleTrendValues(overviewValues, 80);
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
    <div
      className={cn("space-y-1.5", className)}
      data-tour-id="unified-trend-period-brush"
    >
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label="추이 기간"
      >
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
          드래그=기간 · Y고정
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-11 select-none overflow-hidden rounded-md border border-border/80 bg-muted/30"
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
        aria-label={`기간 네비게이터 · 전체 30일 중 ${TREND_PERIODS[period].label} 선택`}
      >
        <svg
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {spark.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const n = Math.max(1, spark.length);
            const x = (i / n) * 100;
            const w = Math.max(0.6, 100 / n - 0.25);
            const h = Math.max(2, (Math.min(100, Math.max(0, v)) / 100) * 34);
            return (
              <rect
                key={i}
                x={x}
                y={40 - h}
                width={w}
                height={h}
                fill="#38bdf8"
                opacity={0.55}
              />
            );
          })}
        </svg>

        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/75",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{ left: 0, width: `${display.start * 100}%` }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/75",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: `${(display.start + display.width) * 100}%`,
            right: 0,
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 border-y-2 border-sky-500 bg-sky-500/20 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.35)]",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: `${display.start * 100}%`,
            width: `${display.width * 100}%`,
          }}
        >
          <span
            className="absolute inset-y-1 left-0 w-1 rounded-sm bg-sky-500"
            aria-hidden
          />
          <span
            className="absolute inset-y-1 right-0 w-1 rounded-sm bg-sky-500"
            aria-hidden
          />
          <span className="absolute inset-x-0 bottom-0.5 text-center text-[0.6rem] font-semibold text-sky-100">
            선택 {TREND_PERIODS[period].label}
          </span>
        </div>
        {period !== "30d" ? (
          <span className="pointer-events-none absolute left-1 top-0.5 text-[0.55rem] font-medium text-muted-foreground/90">
            전체 30일
          </span>
        ) : null}
      </div>
    </div>
  );
}
