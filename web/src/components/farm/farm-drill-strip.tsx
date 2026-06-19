"use client";

import { useRouter } from "next/navigation";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type FarmDrillStripProps = {
  activeFarmKey: FarmKey;
  sp?: string | null;
  view?: string | null;
};

/** Admin scoped /farm — URL scope query 시각화 (stripAdminFarmDrillDown) */
export function FarmDrillStrip({
  activeFarmKey,
  sp,
  view,
}: FarmDrillStripProps) {
  const router = useRouter();

  const chips = [
    `lsind=${activeFarmKey.lsindRegistNo}`,
    `item=${activeFarmKey.itemCode}`,
    ...(sp ? [`sp=${sp}`] : []),
    ...(view === "list" ? ["view=list"] : []),
  ];

  return (
    <div
      className={cn(
        dashboardUi.scopeBar,
        "border-dashed bg-muted/10"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={dashboardUi.scopeLabel}>Monitoring</span>
        <span className={cn(dashboardUi.scopeChip, "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200")}>
          {farmShortLabel(activeFarmKey)}
        </span>
        {chips.map((c) => (
          <span
            key={c}
            className={cn(
              dashboardUi.scopeChip,
              "border-border text-muted-foreground"
            )}
          >
            {c}
          </span>
        ))}
        <button
          type="button"
          onClick={() => router.replace("/farm", { scroll: false })}
          className={cn(
            "ml-auto rounded-lg border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            dashboardUi.tableMeta
          )}
        >
          전국 지도로
        </button>
      </div>
    </div>
  );
}
