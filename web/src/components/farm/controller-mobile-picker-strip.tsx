"use client";

import { useEffect, useRef } from "react";
import type { BarnReading } from "@/lib/data/iot";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import {
  stallKeyFromReading,
  stallLabelFromKey,
} from "@/lib/data/reading-hierarchy";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  readings: BarnReading[];
  selectedKey: string;
  onSelect: (key: string) => void;
  showAffiliation?: boolean;
  className?: string;
};

/** bottom sheet 상단 — 컨트롤러 EQP 가로 swipe picker (스크롤바 숨김) */
export function ControllerMobilePickerStrip({
  readings,
  selectedKey,
  onSelect,
  showAffiliation = false,
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const btn = selectedRef.current;
    if (!scroller || !btn) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const delta =
      btnRect.left -
      scrollerRect.left -
      scrollerRect.width / 2 +
      btnRect.width / 2;
    scroller.scrollBy({ left: delta, behavior: "smooth" });
  }, [selectedKey]);

  if (readings.length <= 1) return null;

  return (
    <div
      className={cn("border-b bg-muted/20 px-2 py-2", className)}
      data-tour-id="controller-mobile-picker"
    >
      <div
        ref={scrollerRef}
        className="controller-mobile-picker-scroller flex gap-2 overflow-x-auto pb-0.5"
        role="listbox"
        aria-label="컨트롤러 선택"
      >
        {readings.map((r) => {
          const selected = r.key === selectedKey;
          const affiliation = showAffiliation
            ? `${formatStallTypeLabel(r.stallTyCode)} · ${stallLabelFromKey(stallKeyFromReading(r))}`
            : null;
          return (
            <button
              key={r.key}
              ref={selected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(r.key)}
              className={cn(
                "controller-mobile-picker-item inline-flex min-w-[5.5rem] shrink-0 snap-start flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                selected
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold leading-snug">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-sm",
                    r.status === "normal" && "bg-emerald-500",
                    r.status === "caution" && "bg-amber-500",
                    r.status === "offline" && "bg-muted-foreground",
                  )}
                  aria-hidden
                />
                {formatControllerNoLabel(r.eqpmnNo)}
              </span>
              {affiliation ? (
                <span
                  className={cn(
                    "mt-0.5 max-w-[8rem] truncate",
                    dashboardTypography.meta,
                    selected ? "text-emerald-800/80 dark:text-emerald-300/80" : undefined,
                  )}
                >
                  {affiliation}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
