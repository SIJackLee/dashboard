"use client";

import {
  TREND_PERIODS,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { cn } from "@/lib/utils";

export const TREND_PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

type Props = {
  value: TrendPeriodId;
  onChange: (period: TrendPeriodId) => void;
  className?: string;
  ariaLabel?: string;
  /** farm-map 투어 — period-select 타깃 */
  tourTarget?: boolean;
  /** map toolbar vs list panel — padding·typography */
  density?: "map" | "list";
};

export function TrendPeriodToggle({
  value,
  onChange,
  className,
  ariaLabel = "기간",
  tourTarget = false,
  density = "list",
}: Props) {
  const isMap = density === "map";

  return (
    <div
      className={cn(
        "inline-flex rounded-md border bg-background",
        isMap ? "overflow-hidden text-xs" : "shrink-0 overflow-x-auto",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
      {...(tourTarget ? { "data-tour-id": "period-select" } : {})}
    >
      {TREND_PERIOD_ORDER.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "font-medium transition-colors",
            isMap
              ? "px-2.5 py-1"
              : "shrink-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
            value === p
              ? "bg-sky-50 text-sky-700"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {TREND_PERIODS[p].label}
        </button>
      ))}
    </div>
  );
}
