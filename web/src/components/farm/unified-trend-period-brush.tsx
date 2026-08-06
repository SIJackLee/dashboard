"use client";

import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { TREND_PERIODS, nextTrendPeriod } from "@/lib/data/farm-trend-types";
import {
  comfortScoreBandLabel,
  comfortScoreToColor,
} from "@/lib/farm/env-comfort-score";
import { downsampleTrendValues } from "@/lib/farm/trend-display-buckets";
import { motionClass } from "@/lib/ui/motion-classes";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
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

function brushTimeHint(index: number, count: number): string {
  if (count <= 0) return "30일 구간";
  const frac = (index + 0.5) / count;
  const daysAgo = Math.round((1 - frac) * 30);
  if (daysAgo <= 0) return "최근";
  if (daysAgo >= 30) return "약 30일 전";
  return `약 ${daysAgo}일 전`;
}

type HoverBar = {
  index: number;
  score: number;
  /** 0~1 — 카드 가로 위치 */
  ratio: number;
};

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
  const [hover, setHover] = useState<HoverBar | null>(null);
  const sheenId = `brush-track-sheen-${useId().replace(/:/g, "")}`;

  const spark = useMemo(() => {
    if (overviewValues.length <= 96) return overviewValues;
    return downsampleTrendValues(overviewValues, 96);
  }, [overviewValues]);

  const avgScore = useMemo(() => {
    const n = spark.length;
    if (n === 0) return null;
    const { start, width } = BRUSH_PERIOD_WINDOW[period];
    const from = Math.max(0, Math.floor(start * n));
    const to = Math.min(n, Math.ceil((start + width) * n));
    let sum = 0;
    let count = 0;
    for (let i = from; i < to; i++) {
      const v = spark[i];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    return count > 0 ? sum / count : null;
  }, [spark, period]);

  const win = BRUSH_PERIOD_WINDOW[period];
  const periodLabel = TREND_PERIODS[period].label;
  const nextPeriodLabel = TREND_PERIODS[nextTrendPeriod(period)].label;
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

  const updateHoverFromClientX = (clientX: number) => {
    if (dragRef.current || spark.length === 0) {
      setHover(null);
      return;
    }
    const r = ratioFromEvent(clientX);
    const n = spark.length;
    const index = Math.min(n - 1, Math.max(0, Math.floor(r * n)));
    const raw = spark[index];
    if (raw == null || !Number.isFinite(raw)) {
      setHover(null);
      return;
    }
    setHover({
      index,
      score: Math.max(0, Math.min(100, raw)),
      ratio: (index + 0.5) / n,
    });
  };

  const commitDraft = (a: number, b: number) => {
    const next = resolveBrushPeriodFromDraft(a, b);
    onPeriodChange(next);
    setDraft(null);
    dragRef.current = null;
  };

  const hoverBand = hover ? comfortScoreBandLabel(hover.score) : null;

  return (
    <div
      className={cn("space-y-2", className)}
      data-tour-id="unified-trend-period-brush"
      data-farm-chart-period-nav=""
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div
          className="flex flex-wrap items-center gap-2 farm-chart-fs-legend text-muted-foreground"
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
            <span className="size-2 rounded-sm bg-destructive/80" />
            이탈
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {avgScore != null ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md border border-border/60 bg-muted/40",
                "px-2.5 py-1 farm-chart-fs-meta font-semibold tabular-nums text-foreground/80",
              )}
            >
              {periodLabel} 평균 {Math.round(avgScore)}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`추이 기간 ${periodLabel} · 클릭 시 ${nextPeriodLabel}`}
            title={`${periodLabel} → ${nextPeriodLabel}`}
            onClick={() => onPeriodChange(nextTrendPeriod(period))}
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 farm-chart-fs-meta font-medium",
              motionClass.microHover,
              dashboardUi.headerActionBtnActive,
            )}
          >
            {periodLabel}
          </button>
        </div>
      </div>

      <div className="relative">
        {hover && hoverBand ? (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[calc(100%+0.35rem)] z-20 w-[7.5rem] -translate-x-1/2",
              "rounded-lg border border-border/80 bg-popover px-2.5 py-2 text-popover-foreground",
              "ring-1 ring-foreground/10",
            )}
            style={{
              left: `clamp(3.75rem, ${hover.ratio * 100}%, calc(100% - 3.75rem))`,
            }}
            role="status"
            data-tour-id="unified-trend-brush-score-card"
          >
            <p className="farm-chart-fs-legend font-medium text-muted-foreground">
              환경 양호도
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className="text-xl font-bold tabular-nums leading-none tracking-tight"
                style={{ color: comfortScoreToColor(hover.score) }}
              >
                {Math.round(hover.score)}
              </span>
              <span className="farm-chart-fs-legend text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: comfortScoreToColor(hover.score) }}
                aria-hidden
              />
              <span className="farm-chart-fs-meta font-semibold text-foreground">
                {hoverBand}
              </span>
            </div>
            <p className="mt-1 farm-chart-fs-legend leading-snug text-muted-foreground">
              {brushTimeHint(hover.index, spark.length)}
            </p>
          </div>
        ) : null}

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
            setHover(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = ratioFromEvent(e.clientX);
            dragRef.current = { a: r, b: r };
            setDraft({ a: r, b: r });
          }}
          onPointerMove={(e) => {
            if (dragRef.current) {
              const r = ratioFromEvent(e.clientX);
              dragRef.current = { ...dragRef.current, b: r };
              setDraft({ a: dragRef.current.a, b: r });
              return;
            }
            updateHoverFromClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (!dragRef.current) return;
            const r = ratioFromEvent(e.clientX);
            commitDraft(dragRef.current.a, r);
            updateHoverFromClientX(e.clientX);
          }}
          onPointerCancel={() => {
            setDraft(null);
            dragRef.current = null;
            setHover(null);
          }}
          onPointerLeave={() => {
            if (!dragRef.current) setHover(null);
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
                <stop
                  offset="0%"
                  stopColor="rgb(255 255 255)"
                  stopOpacity="0.06"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(255 255 255)"
                  stopOpacity="0"
                />
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
              const active = hover?.index === i;
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
                  opacity={active ? 1 : 0.88}
                  style={
                    {
                      ["--farm-brush-bar-delay" as string]: `${delayMs}ms`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </svg>

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

          {draftWin != null ? (
            <div
              className="pointer-events-none absolute inset-y-1 rounded-sm border border-dashed border-primary/50 bg-primary/10"
              style={{
                left: `${draftWin.start * 100}%`,
                width: `${draftWin.width * 100}%`,
              }}
              aria-hidden
            />
          ) : null}

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 border-y-2 border-primary/80 bg-primary/15",
              "shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]",
              motionClass.farmChartBrushWindow,
              draft && "border-primary",
            )}
            style={{
              left: `${(draft ? snapWin : win).start * 100}%`,
              width: `${(draft ? snapWin : win).width * 100}%`,
            }}
          >
            <span
              className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary/80"
              aria-hidden
            />
            <span
              className="absolute inset-y-2 right-0 w-1 rounded-full bg-primary/80"
              aria-hidden
            />
          </div>
          <span
            className={cn(
              "pointer-events-none absolute bottom-1.5 z-[2] -translate-x-1/2",
              "whitespace-nowrap rounded bg-primary/90 px-1.5 py-0.5",
              "farm-chart-fs-meta font-semibold tracking-wide text-primary-foreground backdrop-blur-sm",
            )}
            style={{
              left: `clamp(3.25rem, ${((draft ? snapWin : win).start + (draft ? snapWin : win).width / 2) * 100}%, calc(100% - 3.25rem))`,
            }}
          >
            {draft
              ? `적용 · 최근 ${TREND_PERIODS[snapPeriod].label}`
              : `최근 ${TREND_PERIODS[period].label}`}
          </span>

          <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-background/50 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-muted-foreground/90 backdrop-blur-sm">
            전체 30일 맥락
          </span>
          {draft ? (
            <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-primary/40 bg-primary/90 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-primary-foreground backdrop-blur-sm">
              폭→기간 프리셋 · 세밀 줌은 위 차트
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
