"use client";

import { useMemo } from "react";
import type { SidoClusterSummary } from "@/lib/data/farm-geo-summary";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  clusters: SidoClusterSummary[];
  activeSido: string | null;
  onSelectSido: (sido: string | null) => void;
  unlocatedCount: number;
  className?: string;
};

const btnClass = (active: boolean, hasIssue: boolean) =>
  cn(
    "w-full whitespace-nowrap rounded-lg border px-3 py-1.5 text-left font-medium transition-colors",
    dashboardUi.body,
    active
      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
      : hasIssue
        ? "border-amber-300/60 text-amber-800 hover:bg-amber-50/50"
        : "text-muted-foreground hover:bg-muted"
  );

export function FarmRegionPanel({
  clusters,
  activeSido,
  onSelectSido,
  unlocatedCount,
  className,
}: Props) {
  const totalFarms = useMemo(
    () => clusters.reduce((n, c) => n + c.farmCount, 0),
    [clusters]
  );
  const totalAlarms = useMemo(
    () => clusters.reduce((n, c) => n + c.alarmCount, 0),
    [clusters]
  );

  return (
    <aside
      className={cn(
        "flex w-max max-w-full shrink-0 flex-col gap-1.5 self-start overflow-y-auto rounded-xl border bg-muted/15 p-2",
        "max-h-[calc(100vh-13rem)]",
        className
      )}
      aria-label="시·도 필터"
    >
      <button
        type="button"
        onClick={() => onSelectSido(null)}
        className={btnClass(activeSido === null, false)}
      >
        전국 {totalFarms}개 · 알람 {totalAlarms}
      </button>
      {clusters.map((c) => (
        <button
          key={c.sido}
          type="button"
          onClick={() => onSelectSido(c.sido)}
          className={btnClass(activeSido === c.sido, c.issueCount > 0)}
        >
          {c.sido.replace(/특별자치도|특별자치시|광역시|도$/g, "")} {c.farmCount}
          {c.alarmCount > 0 ? (
            <span className="ml-1 tabular-nums text-amber-700">· {c.alarmCount}</span>
          ) : null}
        </button>
      ))}
      {unlocatedCount > 0 ? (
        <p className={cn("px-1 pt-1 text-muted-foreground", dashboardUi.tableMeta)}>
          위치 미설정 {unlocatedCount}
        </p>
      ) : null}
    </aside>
  );
}
