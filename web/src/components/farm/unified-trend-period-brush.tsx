"use client";

import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import {
  comfortScoreBandLabel,
  comfortScoreToColor,
} from "@/lib/farm/env-comfort-score";
import { downsampleTrendValues } from "@/lib/farm/trend-display-buckets";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/** 30d 컨텍스트 기준 — 우측(now) 정렬 윈도우 비율 (농장 기간 시드용) */
export const BRUSH_PERIOD_WINDOW: Record<
  TrendPeriodId,
  BrushWindow
> = {
  "30d": { start: 0, width: 1 },
  "7d": { start: 1 - 7 / 30, width: 7 / 30 },
  "24h": { start: 1 - 1 / 30, width: 1 / 30 },
};

const BRUSH_VIEW_H = 88;
const BRUSH_BASELINE = 82;
const BRUSH_MAX_BAR = 70;

/** 드래그 없이 탭으로 판정하는 최대 폭(비율) */
const BRUSH_CLICK_SPAN = 0.02;

/** 최소 구간 — 약 6시간 (30일 트랙 기준) */
export const BRUSH_MIN_WIDTH = 6 / (30 * 24);

export type BrushWindow = { start: number; width: number };

export type BrushHighlightWindow = BrushWindow;

export function clampBrushWindow(start: number, width: number): BrushWindow {
  const w = Math.min(1, Math.max(BRUSH_MIN_WIDTH, width));
  const s = Math.min(1 - w, Math.max(0, start));
  return { start: s, width: w };
}

/** 드래그 → 실구간. 거의 클릭이면 null — 호출측에서 창 이동. */
export function brushWindowFromDraft(
  a: number,
  b: number,
): BrushWindow | null {
  const span = Math.abs(b - a);
  if (span < BRUSH_CLICK_SPAN) return null;
  return clampBrushWindow(Math.min(a, b), span);
}

export function moveBrushWindow(
  win: BrushWindow,
  center: number,
): BrushWindow {
  return clampBrushWindow(center - win.width / 2, win.width);
}

export function displayPeriodFromBrushWindow(win: BrushWindow): TrendPeriodId {
  const days = win.width * 30;
  if (days <= 2) return "24h";
  if (days <= 10) return "7d";
  return "30d";
}

export function formatBrushWindowLabel(win: BrushWindow): string {
  const days = win.width * 30;
  const hours = days * 24;
  if (hours < 20) return `약 ${Math.max(1, Math.round(hours))}시간`;
  if (days < 1.6) return "약 1일";
  return `약 ${Math.round(days)}일`;
}

/** 차트 X 스코프 → 브러시 선택창 안 하이라이트 (0~1) */
export function resolveBrushHighlightWindow(
  win: BrushWindow,
  xScope: { start: number; end: number } | null | undefined,
  chartPointCount: number,
): BrushHighlightWindow {
  if (!xScope || chartPointCount < 2) return win;

  const span = chartPointCount - 1;
  const i0 = Math.max(0, Math.min(xScope.start, xScope.end));
  const i1 = Math.min(span, Math.max(xScope.start, xScope.end));
  if (i1 <= i0) return win;

  const relStart = i0 / span;
  const relEnd = i1 / span;
  const relWidth = Math.max(0.02, relEnd - relStart);

  return {
    start: win.start + relStart * win.width,
    width: relWidth * win.width,
  };
}

function averageSparkScore(
  spark: (number | null)[],
  win: BrushWindow,
): number | null {
  const n = spark.length;
  if (n === 0) return null;
  const from = Math.max(0, Math.floor(win.start * n));
  const to = Math.min(n, Math.ceil((win.start + win.width) * n));
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
  window: BrushWindow;
  onWindowChange: (next: BrushWindow) => void;
  /** 30d 환경 양호도 점수(0~100) */
  overviewValues?: (number | null)[];
  /** 차트 X 스코프 — 브러시 선택창 동기화 */
  xScope?: { start: number; end: number } | null;
  /** 현재 기간 차트 포인트 수 (스코프 인덱스 기준) */
  chartPointCount?: number;
  className?: string;
};

/**
 * 30일 양호도 내비 — 드래그로 실구간, 탭으로 같은 폭 이동.
 * 차트는 선택 구간만 표시. 농장 24h/7d/30d 상태는 바꾸지 않음.
 */
export function UnifiedTrendPeriodBrush({
  window: winProp,
  onWindowChange,
  overviewValues = [],
  xScope = null,
  chartPointCount = 0,
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

  const win = useMemo(
    () => resolveBrushHighlightWindow(winProp, xScope, chartPointCount),
    [winProp, xScope, chartPointCount],
  );
  const scopedActive =
    xScope != null && chartPointCount >= 2 && win.width < winProp.width - 0.001;

  const windowLabel = formatBrushWindowLabel(winProp);
  const resolvedDraft =
    draft != null ? brushWindowFromDraft(draft.a, draft.b) : null;
  const activeWin = resolvedDraft ?? (draft != null ? winProp : win);
  const avgScore = useMemo(
    () => averageSparkScore(spark, activeWin),
    [spark, activeWin],
  );
  const draftWin =
    draft != null
      ? {
          start: Math.min(draft.a, draft.b),
          width: Math.max(BRUSH_MIN_WIDTH, Math.abs(draft.b - draft.a)),
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
    const fromDrag = brushWindowFromDraft(a, b);
    onWindowChange(fromDrag ?? moveBrushWindow(winProp, a));
    setDraft(null);
    dragRef.current = null;
  };

  const hoverBand = hover ? comfortScoreBandLabel(hover.score) : null;
  const scoreLabel =
    avgScore != null ? String(Math.round(avgScore)) : "—";

  return (
    <div
      className={cn(className)}
      data-tour-id="unified-trend-period-brush"
      data-farm-chart-period-nav=""
    >
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
            "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/_0.04)]",
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
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(winProp.start * 100)}
          aria-valuetext={`${windowLabel}${scopedActive ? " · 차트 스코프 구간" : ""} · 점수 ${scoreLabel}`}
          aria-label={`30일 구간 선택 ${windowLabel} · 드래그로 구간 · 탭으로 같은 폭 이동 · 우클릭으로 30일 전체`}
          title={`드래그: 구간 선택 · 탭: 같은 폭으로 이동 · 우클릭: 30일 전체${scopedActive ? " · 스코프 구간 표시" : ""}`}
          onContextMenu={(e) => {
            e.preventDefault();
            setDraft(null);
            dragRef.current = null;
            setHover(null);
            onWindowChange(BRUSH_PERIOD_WINDOW["30d"]);
          }}
          onKeyDown={(e) => {
            const step = 0.03;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const dir = e.key === "ArrowLeft" ? -step : step;
              onWindowChange(
                clampBrushWindow(winProp.start + dir, winProp.width),
              );
              return;
            }
            if (e.key === "Home") {
              e.preventDefault();
              onWindowChange(clampBrushWindow(0, winProp.width));
              return;
            }
            if (e.key === "End") {
              e.preventDefault();
              onWindowChange(clampBrushWindow(1 - winProp.width, winProp.width));
            }
          }}
        >
          <svg
            viewBox={`0 0 100 ${BRUSH_VIEW_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full text-foreground"
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
            <line
              x1={0}
              x2={100}
              y1={BRUSH_BASELINE - 0.75 * BRUSH_MAX_BAR}
              y2={BRUSH_BASELINE - 0.75 * BRUSH_MAX_BAR}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeDasharray="2 2.5"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
              !draft && motionClass.farmChartBrushWindow,
            )}
            style={{
              left: 0,
              width: `${activeWin.start * 100}%`,
            }}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 bg-background/70 backdrop-blur-[1px]",
              !draft && motionClass.farmChartBrushWindow,
            )}
            style={{
              left: `${(activeWin.start + activeWin.width) * 100}%`,
              right: 0,
            }}
          />

          {draftWin != null && resolvedDraft != null ? (
            <div
              className="pointer-events-none absolute inset-y-1 rounded-sm border border-dashed border-foreground/35 bg-foreground/5"
              style={{
                left: `${draftWin.start * 100}%`,
                width: `${draftWin.width * 100}%`,
              }}
              aria-hidden
            />
          ) : null}

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 border-y border-foreground/40",
              motionClass.farmChartBrushWindow,
              draft && resolvedDraft != null && "border-foreground/60",
            )}
            style={{
              left: `${activeWin.start * 100}%`,
              width: `${activeWin.width * 100}%`,
            }}
          >
            <span
              className="absolute inset-y-2 left-0 w-1 rounded-full bg-foreground/70"
              aria-hidden
            />
            <span
              className="absolute inset-y-2 right-0 w-1 rounded-full bg-foreground/70"
              aria-hidden
            />
          </div>

          {resolvedDraft != null ? (
            <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-primary/40 bg-primary/90 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-primary-foreground backdrop-blur-sm">
              {formatBrushWindowLabel(resolvedDraft)}
            </span>
          ) : draft ? (
            <span className="pointer-events-none absolute right-2 top-1.5 rounded border border-border/60 bg-background/90 px-1.5 py-0.5 farm-chart-fs-axis font-medium text-muted-foreground backdrop-blur-sm">
              탭→같은 폭 이동
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
