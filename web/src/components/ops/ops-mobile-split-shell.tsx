"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ControllerReading } from "@/lib/data/iot";
import { formatControllerPillLabelShort } from "@/lib/ui/controller-labels";
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

type Props = {
  title: string;
  subtitle?: string;
  nav?: NavProps;
  topPanel: React.ReactNode;
  control: React.ReactNode;
  headerSlot?: React.ReactNode;
  /** 농장 선택 후 축사유형 선택 등 */
  midPanel?: React.ReactNode;
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  placeholder?: boolean;
  /** map | grid — 상단 패널 높이 비율 */
  topVariant?: "map" | "grid";
};

const SWIPE_THRESHOLD_PX = 48;

function OpsMobileSplitNav({
  title,
  subtitle,
  nav,
}: {
  title: string;
  subtitle?: string;
  nav?: NavProps;
}) {
  const touchStartX = useRef<number | null>(null);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const navKey = `${title}|${subtitle ?? ""}`;

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
      className="flex shrink-0 touch-pan-y items-center gap-2 rounded-xl border bg-muted/15 px-2 py-2"
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
            "transition-transform duration-200 ease-out",
            animDir === "left" && "animate-in slide-in-from-right-4 fade-in",
            animDir === "right" && "animate-in slide-in-from-left-4 fade-in"
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

export function OpsMobileSplitShell({
  title,
  subtitle,
  nav,
  topPanel,
  control,
  headerSlot,
  midPanel,
  controllerList = [],
  selectedControllerKey,
  onControllerSelect,
  placeholder,
  topVariant = "map",
}: Props) {
  const topPanelClass =
    topVariant === "grid"
      ? "max-h-[min(32dvh,260px)] shrink-0 overflow-y-auto overscroll-contain"
      : "h-[min(28dvh,220px)] shrink-0 overflow-hidden";

  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col gap-2 lg:hidden">
      {headerSlot}

      <OpsMobileSplitNav title={title} subtitle={subtitle} nav={nav} />

      {midPanel ? (
        <div className="shrink-0 overflow-hidden">{midPanel}</div>
      ) : null}

      <div className={topPanelClass}>{topPanel}</div>

      {controllerList.length > 1 && onControllerSelect ? (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none]">
          {controllerList.map((reading) => {
            const active = reading.key === selectedControllerKey;
            return (
              <button
                key={reading.key}
                type="button"
                onClick={() => onControllerSelect(reading.key)}
                title={reading.label ?? reading.eqpmnNo ?? reading.key}
                className={cn(
                  "max-w-[7.5rem] shrink-0 truncate rounded-lg border px-2 py-1 text-left text-xs transition-colors",
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-transparent bg-muted/30 text-muted-foreground"
                )}
              >
                {formatControllerPillLabelShort({
                  label: reading.label,
                  stallNo: reading.stallNo,
                  eqpmnNo: reading.eqpmnNo,
                })}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card",
          placeholder && "pointer-events-none opacity-50"
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
          {control}
        </div>
      </div>
    </div>
  );
}
