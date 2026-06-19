"use client";

import type { SidoClusterSummary } from "@/lib/data/farm-geo-summary";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  clusters: SidoClusterSummary[];
  activeSido: string | null;
  onSelectSido: (sido: string | null) => void;
  className?: string;
};

const chipClass = (active: boolean, hasIssue: boolean) =>
  cn(
    "shrink-0 rounded-md border px-2 py-0.5 font-medium transition-colors",
    dashboardUi.body,
    active
      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
      : hasIssue
        ? "border-amber-300/60 text-amber-800 hover:bg-amber-50/50"
        : "border-transparent bg-background/90 text-muted-foreground hover:bg-muted"
  );

function shortSido(sido: string): string {
  return sido.replace(/특별자치도|특별자치시|광역시|도$/g, "");
}

export function FarmGeoSidoOverlay({
  clusters,
  activeSido,
  onSelectSido,
  className,
}: Props) {
  const totalFarms = clusters.reduce((n, c) => n + c.farmCount, 0);
  const totalAlarms = clusters.reduce((n, c) => n + c.alarmCount, 0);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-wrap gap-1 p-2",
        className
      )}
      aria-label="시·도 필터"
    >
      <button
        type="button"
        onClick={() => onSelectSido(null)}
        className={cn(chipClass(activeSido === null, false), "pointer-events-auto")}
      >
        전국 {totalFarms}
        {totalAlarms > 0 ? (
          <span className="ml-1 tabular-nums text-amber-700">· {totalAlarms}</span>
        ) : null}
      </button>
      {clusters.map((c) => (
        <button
          key={c.sido}
          type="button"
          onClick={() => onSelectSido(c.sido)}
          className={cn(
            chipClass(activeSido === c.sido, c.issueCount > 0),
            "pointer-events-auto"
          )}
        >
          {shortSido(c.sido)} {c.farmCount}
          {c.alarmCount > 0 ? (
            <span className="ml-1 tabular-nums text-amber-700">· {c.alarmCount}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
