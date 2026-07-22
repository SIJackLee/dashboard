"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
  const [pendingPeriod, setPendingPeriod] = useState<TrendPeriodId | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pendingPeriod != null && value === pendingPeriod) {
      setPendingPeriod(null);
    }
  }, [value, pendingPeriod]);

  useEffect(() => {
    if (!pendingPeriod) return;
    const t = window.setTimeout(() => setPendingPeriod(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingPeriod]);

  const busy = isPending || pendingPeriod != null;

  return (
    <div
      className={cn(
        "inline-flex rounded-md border bg-background",
        isMap ? "overflow-hidden text-xs" : "shrink-0 overflow-x-auto",
        busy && "pointer-events-none opacity-80",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      {...(tourTarget ? { "data-tour-id": "period-select" } : {})}
    >
      {TREND_PERIOD_ORDER.map((p) => {
        const periodBusy = pendingPeriod === p;
        return (
          <button
            key={p}
            type="button"
            disabled={busy}
            aria-busy={periodBusy || undefined}
            onClick={() => {
              if (p === value || busy) return;
              setPendingPeriod(p);
              startTransition(() => onChange(p));
            }}
            className={cn(
              "inline-flex items-center gap-1 font-medium transition-colors disabled:cursor-wait",
              isMap
                ? "px-2.5 py-1"
                : "shrink-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
              value === p
                ? "bg-sky-50 text-sky-700"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {periodBusy ? (
              <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
            ) : null}
            {periodBusy ? `${TREND_PERIODS[p].label}…` : TREND_PERIODS[p].label}
          </button>
        );
      })}
    </div>
  );
}
