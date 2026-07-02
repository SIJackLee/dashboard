"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ControllerReading } from "@/lib/data/iot";
import { formatControllerScrollChipLabel } from "@/lib/ui/controller-labels";
import { cn } from "@/lib/utils";
import { PageActionButton } from "@/components/common/page-action-button";

type NavProps = {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

export type MobileStallOption = {
  value: string;
  /** 세그먼트 표시 — 보통 축사번호만 (01, 02) */
  label: string;
};

type Props = {
  title: string;
  subtitle?: string;
  nav?: NavProps;
  topPanel: React.ReactNode;
  control: React.ReactNode;
  headerSlot?: React.ReactNode;
  /** 농장 선택 후 축사유형 선택 등 */
  midPanel?: React.ReactNode;
  stallOptions?: MobileStallOption[];
  selectedStallKey?: string;
  onStallSelect?: (stallKey: string) => void;
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  /** 농장 선택 전 — 농장목록 트리 등 */
  pickerPanel?: React.ReactNode;
  placeholder?: boolean;
  /** map | grid — 상단 패널 높이 비율 */
  topVariant?: "map" | "grid";
  /** region 필터 등 — 지도 top 높이 축소 */
  topMapCompact?: boolean;
  /** 외부(지도 등) 농장 선택 시 nav 스윕 방향 */
  navSweepDirection?: "left" | "right" | null;
};

const SWIPE_THRESHOLD_PX = 48;

function OpsMobileSplitNav({
  title,
  subtitle,
  nav,
  embedded = false,
  sweepDirection = null,
}: {
  title: string;
  subtitle?: string;
  nav?: NavProps;
  embedded?: boolean;
  sweepDirection?: "left" | "right" | null;
}) {
  const touchStartX = useRef<number | null>(null);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const navKey = `${title}|${subtitle ?? ""}`;

  useEffect(() => {
    if (!sweepDirection) return;
    setAnimDir(sweepDirection);
    const timer = window.setTimeout(() => setAnimDir(null), 220);
    return () => window.clearTimeout(timer);
  }, [sweepDirection, navKey]);

  const runNav = useCallback(
    (direction: "prev" | "next") => {
      if (!nav) return;
      setAnimDir(direction === "next" ? "left" : "right");
      if (direction === "next") nav.onNext();
      else nav.onPrev();
      window.setTimeout(() => setAnimDir(null), 220);
    },
    [nav]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !nav) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) runNav("next");
    else runNav("prev");
  };

  return (
    <div
      className={cn(
        "flex shrink-0 touch-pan-y items-center gap-2 px-1 py-1",
        !embedded && "rounded-xl border bg-muted/15 px-2 py-2"
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {nav ? (
        <PageActionButton
          type="button"
          variant="outline"
          disabled={!nav.hasPrev}
          onClick={() => runNav("prev")}
          aria-label={nav.prevLabel ?? "이전"}
          className="h-9 min-h-9 w-9 shrink-0 px-0"
        >
          <ChevronLeft className="size-5" />
        </PageActionButton>
      ) : null}
      <div className="min-w-0 flex-1 overflow-hidden text-center">
        <div
          key={navKey}
          className={cn(
            "transition-[transform,opacity] duration-300 ease-out",
            animDir === "left" && "animate-in slide-in-from-right-6 fade-in duration-300",
            animDir === "right" && "animate-in slide-in-from-left-6 fade-in duration-300"
          )}
        >
          <p className="truncate text-base font-semibold md:text-lg">{title}</p>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {nav ? (
        <PageActionButton
          type="button"
          variant="outline"
          disabled={!nav.hasNext}
          onClick={() => runNav("next")}
          aria-label={nav.nextLabel ?? "다음"}
          className="h-9 min-h-9 w-9 shrink-0 px-0"
        >
          <ChevronRight className="size-5" />
        </PageActionButton>
      ) : null}
    </div>
  );
}

/** Admin mobile — 농장 선택 후 in-grid 그리드만 (레거시 목록·컨트롤러 시트 없음) */
export function OpsMobileFarmGridOnly({
  title,
  subtitle,
  nav,
  headerSlot,
  grid,
  navSweepDirection = null,
}: {
  title: string;
  subtitle?: string;
  nav?: NavProps;
  headerSlot?: React.ReactNode;
  grid: React.ReactNode;
  navSweepDirection?: "left" | "right" | null;
}) {
  return (
    <div
      className="flex min-h-[calc(100dvh-10.5rem)] flex-col lg:hidden"
      data-audit-region="ops-mobile-farm-grid-only"
    >
      {headerSlot ? <div className="shrink-0">{headerSlot}</div> : null}
      <section className="shrink-0 rounded-xl border bg-muted/10 px-2 py-2">
        <OpsMobileSplitNav
          embedded
          title={title}
          subtitle={subtitle}
          nav={nav}
          sweepDirection={navSweepDirection}
        />
      </section>
      <div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/10">
        {grid}
      </div>
    </div>
  );
}

function MobileStallSegmentRow({
  options,
  selectedStallKey,
  onStallSelect,
}: {
  options: MobileStallOption[];
  selectedStallKey?: string;
  onStallSelect: (stallKey: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <section className="shrink-0 border-b border-border/60 px-2 py-2">
      <p className="mb-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
        축사번호
      </p>
      <div
        className="flex overflow-hidden rounded-lg border border-border"
        role="tablist"
        aria-label="축사번호 선택"
      >
        {options.map((opt) => {
          const active = opt.value === selectedStallKey;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`축사 ${opt.label}`}
              onClick={() => onStallSelect(opt.value)}
              className={cn(
                "min-h-9 min-w-0 flex-1 px-2 py-2 text-center text-sm font-bold tabular-nums transition-colors",
                active
                  ? "bg-background text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/55"
              )}
            >
              <span
                className={cn(
                  "block border-b-2 pb-0.5",
                  active ? "border-primary" : "border-transparent"
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MobileControllerChipRow({
  controllerList,
  selectedControllerKey,
  onControllerSelect,
}: {
  controllerList: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect: (key: string) => void;
}) {
  if (controllerList.length <= 1) return null;

  return (
    <section className="shrink-0 border-b border-border/60 px-2 py-2">
      <p className="mb-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
        컨트롤러
      </p>
      <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {controllerList.map((reading) => {
          const active = reading.key === selectedControllerKey;
          const chipLabel = formatControllerScrollChipLabel({
            eqpmnNo: reading.eqpmnNo,
          });
          return (
            <button
              key={reading.key}
              type="button"
              onClick={() => onControllerSelect(reading.key)}
              title={reading.label ?? reading.eqpmnNo ?? reading.key}
              aria-label={`컨트롤러 ${reading.eqpmnNo ?? reading.key}번`}
              aria-pressed={active}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                active
                  ? "border-orange-400/80 bg-orange-50 text-orange-950 dark:border-orange-500/70 dark:bg-orange-950/40 dark:text-orange-100"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/30"
              )}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function OpsMobileSplitShell({
  title,
  subtitle,
  nav,
  topPanel,
  control,
  headerSlot,
  midPanel,
  stallOptions = [],
  selectedStallKey,
  onStallSelect,
  controllerList = [],
  selectedControllerKey,
  onControllerSelect,
  pickerPanel,
  placeholder,
  topVariant = "map",
  topMapCompact = false,
  navSweepDirection = null,
}: Props) {
  const topPanelClass =
    topVariant === "grid"
      ? "max-h-[min(44dvh,360px)] min-h-[12rem] shrink-0 overflow-y-auto overflow-x-hidden"
      : topMapCompact
        ? "h-[min(24dvh,180px)] shrink-0 overflow-hidden"
        : pickerPanel
          ? "h-[min(28dvh,200px)] shrink-0 overflow-hidden"
          : "h-[min(32dvh,240px)] shrink-0 overflow-hidden";

  const showStallSegment =
    stallOptions.length > 0 && Boolean(onStallSelect) && !placeholder;

  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col lg:hidden">
      {headerSlot ? <div className="shrink-0">{headerSlot}</div> : null}

      <div className={cn(topPanelClass, "rounded-xl border bg-muted/10")}>
        {topPanel}
      </div>

      <div
        className={cn(
          "mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl border border-b-0 bg-card shadow-[0_-6px_28px_rgba(15,23,42,0.08)] dark:shadow-[0_-6px_28px_rgba(0,0,0,0.35)]",
          placeholder && !pickerPanel && "pointer-events-none opacity-50"
        )}
      >
        <div
          className="flex shrink-0 justify-center pt-2 pb-1"
          aria-hidden
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <section className="shrink-0 border-b border-border/60 px-2 pb-2">
            <OpsMobileSplitNav
              embedded
              title={title}
              subtitle={subtitle}
              nav={nav}
              sweepDirection={navSweepDirection}
            />
          </section>

          {midPanel ? (
            <section className="shrink-0 overflow-visible border-b border-border/60 px-2 py-2">
              {midPanel}
            </section>
          ) : null}

          {pickerPanel ? (
            <section className="min-h-0 flex-1 overflow-y-auto border-b border-border/60 px-1 py-2">
              {pickerPanel}
            </section>
          ) : null}

          {showStallSegment ? (
            <MobileStallSegmentRow
              options={stallOptions}
              selectedStallKey={selectedStallKey}
              onStallSelect={onStallSelect!}
            />
          ) : null}

          {onControllerSelect ? (
            <MobileControllerChipRow
              controllerList={controllerList}
              selectedControllerKey={selectedControllerKey}
              onControllerSelect={onControllerSelect}
            />
          ) : null}

          <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
            {control}
          </section>
        </div>
      </div>
    </div>
  );
}
