"use client";

import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import { comfortScoreToColor } from "@/lib/farm/env-comfort-score";
import { downsampleTrendValues } from "@/lib/farm/trend-display-buckets";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/** 30d 컨텍스트 기준 — 우측(now) 정렬 윈도우 비율 (API 기간과 동일) */
export const BRUSH_PERIOD_WINDOW: Record<
  TrendPeriodId,
  { start: number; width: number }
> = {
  "30d": { start: 0, width: 1 },
  "7d": { start: 1 - 7 / 30, width: 7 / 30 },
  "24h": { start: 1 - 1 / 30, width: 1 / 30 },
};

const PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

const BRUSH_VIEW_H = 88;
const BRUSH_BASELINE = 82;
const BRUSH_MAX_BAR = 70;

export function snapBrushSpanToPeriod(span: number): TrendPeriodId {
  if (span <= 0.08) return "24h";
  if (span <= 0.35) return "7d";
  return "30d";
}

/** 드래그/탭 → 기간 프리셋. 폭 우선, 거의 클릭이면 위치 존. */
export function resolveBrushPeriodFromDraft(
  a: number,
  b: number,
): TrendPeriodId {
  const left = Math.min(a, b);
  const span = Math.abs(b - a);
  if (span < 0.02) {
    if (left >= BRUSH_PERIOD_WINDOW["24h"].start) return "24h";
    if (left >= BRUSH_PERIOD_WINDOW["7d"].start) return "7d";
    return "30d";
  }
  return snapBrushSpanToPeriod(span);
}

type Props = {
  period: TrendPeriodId;
  onPeriodChange: (period: TrendPeriodId) => void;
  /** 30d 환경 양호도 점수(0~100) */
  overviewValues?: (number | null)[];
  className?: string;
};

/**
 * TradingView형 기간 네비게이터 — 온·습 양호도 스파크 + 프리셋 윈도우.
 * 드래그 폭 → 24h/7d/30d 프리셋. 차트는 항상 **최근** N 구간(위치≠임의 구간).
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
  const sheenId = `brush-track-sheen-${useId().replace(/:/g, "")}`;

  const spark = useMemo(() => {
    if (overviewValues.length <= 96) return overviewValues;
    return downsampleTrendValues(overviewValues, 96);
  }, [overviewValues]);

  const avgScore = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const v of spark) {
      if (v != null && Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    return n > 0 ? sum / n : null;
  }, [spark]);

  const win = BRUSH_PERIOD_WINDOW[period];
  const snapPeriod =
    draft != null ? resolveBrushPeriodFromDraft(draft.a, draft.b) : period;
  const snapWin = BRUSH_PERIOD_WINDOW[snapPeriod];
  const draftWin =
    draft != null
      ? {
          start: Math.min(draft.a, draft.b),
          width: Math.max(0.02, Math.abs(draft.b - draft.a)),
        }
      : null;

  const ratioFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const commitDraft = (a: number, b: number) => {
    const next = resolveBrushPeriodFromDraft(a, b);
    onPeriodChange(next);
    setDraft(null);
    dragRef.current = null;
  };

  return (
    <div
      className={cn("space-y-2", className)}
      data-tour-id="unified-trend-period-brush"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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
                "rounded-md border px-2.5 py-1 text-[0.7rem] font-medium",
                motionClass.microHover,
                period === id
                  ? "border-sky-500/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                  : "border-border bg-muted/20 text-muted-foreground",
              )}
            >
              {TREND_PERIODS[id].label}
            </button>
          ))}
        </div>

        <div
          className="ml-auto flex flex-wrap items-center gap-2 text-[0.65rem] text-muted-foreground"
          aria-hidden
        >
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500" />
            양호
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-amber-400" />
            주의
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-rose-500" />
            이탈
          </span>
          {avgScore != null ? (
            <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-semibold tabular-nums text-foreground/80">
              30일 평균 {Math.round(avgScore)}
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-[0.65rem] leading-snug text-muted-foreground">
        막대 = 온·습 적정 점수 · 드래그{" "}
        <span className="font-medium text-foreground/80">폭</span>
        =24h/7d/30d 프리셋 · 차트는 항상{" "}
        <span className="font-medium text-foreground/80">최근</span> 구간 ·
        세밀 줌은 위 차트 드래그 · 모터 제외
      </p>

      <div
        ref={trackRef}
        className={cn(
          "relative h-[5.5rem] select-none overflow-hidden rounded-xl border border-border/80",
          "bg-gradient-to-b from-muted/50 via-muted/25 to-background/90",
          "shadow-[inset_0_1px_0_0_hsl(0_0%_100%_/_0.04)]",
          "cursor-ew-resize touch-none",
        )}
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
        aria-label={`기간 프리셋 네비게이터 · 드래그 폭으로 24시간/7일/30일 선택 · 현재 최근 ${TREND_PERIODS[period].label}`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-emerald-500/25"
          style={{
            top: `${((BRUSH_VIEW_H - BRUSH_BASELINE + BRUSH_MAX_BAR * 0.75) / BRUSH_VIEW_H) * 100}%`,
          }}
          aria-hidden
        />

        <svg
          viewBox={`0 0 100 ${BRUSH_VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="rgb(255 255 255)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={100}
            height={BRUSH_VIEW_H}
            fill={`url(#${sheenId})`}
          />
          {spark.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const n = Math.max(1, spark.length);
            const x = (i / n) * 100;
            const w = Math.max(0.55, 100 / n - 0.2);
            const score = Math.max(0, Math.min(100, v));
            const h = Math.max(3, (score / 100) * BRUSH_MAX_BAR);
            const delayMs = Math.min(480, Math.round((i / n) * 420));
            return (
              <rect
                key={i}
                className={motionClass.farmChartBrushBar}
                x={x}
                y={BRUSH_BASELINE - h}
                width={w}
                height={h}
                rx={Math.min(0.45, w * 0.35)}
                fill={comfortScoreToColor(score)}
                opacity={0.88}
                style={
                  {
                    ["--farm-brush-bar-delay" as string]: `${delayMs}ms`,
                  } as CSSProperties
                }
              />
            );
          })}
        </svg>

        {/* 확정 윈도우 = 최근 정렬 (데이터와 동일) */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: 0,
            width: `${(draft ? snapWin : win).start * 100}%`,
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
            !draft && motionClass.farmChartBrushWindow,
          )}
          style={{
            left: `${((draft ? snapWin : win).start + (draft ? snapWin : win).width) * 100}%`,
            right: 0,
          }}
        />

        {/* 드래그 중: 사용자 궤적(점선) + 적용 예정 최근 윈도우(실선) */}
        {draftWin != null ? (
          <div
            className="pointer-events-none absolute inset-y-1 rounded-sm border border-dashed border-sky-400/70 bg-sky-500/10"
            style={{
              left: `${draftWin.start * 100}%`,
              width: `${draftWin.width * 100}%`,
            }}
            aria-hidden
          />
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 border-y-2 border-sky-500/90 bg-sky-500/15",
            "shadow-[inset_0_0_0_1px_rgba(14,165,233,0.4),0_0_24px_-8px_rgba(14,165,233,0.45)]",
            motionClass.farmChartBrushWindow,
            draft && "border-sky-400",
          )}
          style={{
            left: `${(draft ? snapWin : win).start * 100}%`,
            width: `${(draft ? snapWin : win).width * 100}%`,
          }}
        >
          <span
            className="absolute inset-y-2 left-0 w-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
            aria-hidden
          />
          <span
            className="absolute inset-y-2 right-0 w-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
            aria-hidden
          />
          <span className="absolute inset-x-0 bottom-1.5 text-center text-[0.68rem] font-semibold tracking-wide text-sky-50 drop-shadow-sm">
            {draft
              ? `적용 · 최근 ${TREND_PERIODS[snapPeriod].label}`
              : `최근 ${TREND_PERIODS[period].label}`}
          </span>
        </div>

        <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-background/50 px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground/90 backdrop-blur-sm">
          전체 30일 맥락
        </span>
        {draft ? (
          <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-sky-500/40 bg-sky-950/50 px-1.5 py-0.5 text-[0.6rem] font-medium text-sky-100 backdrop-blur-sm">
            폭→프리셋 · 위치≠임의 구간
          </span>
        ) : null}
      </div>
    </div>
  );
}
