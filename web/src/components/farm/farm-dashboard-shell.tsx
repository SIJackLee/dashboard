"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminFarmOverview } from "@/components/admin/admin-farm-overview";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import { FarmDrillStrip } from "@/components/farm/farm-drill-strip";
import { ScopeBar } from "@/components/layout/scope-bar";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { AdminFarmGridPanel } from "@/lib/farm/load-admin-all-farms-grid";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type FarmMapMode = "geo" | "grid";

type FarmDashboardShellProps =
  | {
      mapMode: "geo";
      farms: FarmSummaryRow[];
      locations: FarmLocationRow[];
    }
  | {
      mapMode: "grid";
      readings: BarnReading[];
      barnSnapshots: BarnMapSnapshot[];
      gridCols: number;
      gridRows: number;
      isAdmin?: boolean;
      farmOptions?: FarmKey[];
      activeFarmKey?: FarmKey | null;
      farmSummaries?: FarmSummaryRow[];
      sp?: string | null;
      view?: string | null;
      trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
      controller?: ControllerGridData | null;
      /** Admin 전체 농장 — farm별 그리드 스택 */
      allFarmGrids?: AdminFarmGridPanel[] | null;
    };

export function FarmDashboardShell(props: FarmDashboardShellProps) {
  const router = useRouter();

  if (props.mapMode === "geo") {
    return (
      <AdminFarmOverview farms={props.farms} locations={props.locations} />
    );
  }

  const {
    readings,
    barnSnapshots,
    gridCols,
    gridRows,
    isAdmin = false,
    farmOptions = [],
    activeFarmKey = null,
    farmSummaries = [],
    sp,
    view,
    trendByPeriod,
    controller,
    allFarmGrids = null,
  } = props;

  const showAdminScope = isAdmin && farmOptions.length > 0;
  const adminAllFarmsMode =
    isAdmin && !activeFarmKey && allFarmGrids !== null;

  return (
    <div className="space-y-4 md:space-y-5">
      {showAdminScope ? (
        <ScopeBar
          sticky
          adminFarmSwitcher={{
            farmOptions,
            activeFarmKey,
            farmSummaries,
            compact: true,
          }}
          onRefresh={() => router.refresh()}
        />
      ) : null}

      {isAdmin && activeFarmKey ? (
        <FarmDrillStrip
          activeFarmKey={activeFarmKey}
          sp={sp}
          view={view}
        />
      ) : null}

      <Suspense
        fallback={
          <div className="min-h-[12rem] rounded-xl border bg-background p-6">
            <p className={cn("text-muted-foreground", dashboardUi.body)}>
              로딩…
            </p>
          </div>
        }
      >
        {adminAllFarmsMode ? (
          <AdminAllFarmsGridPanels panels={allFarmGrids ?? []} />
        ) : (
          <FarmPageContent
            readings={readings}
            barnSnapshots={barnSnapshots}
            gridCols={gridCols}
            gridRows={gridRows}
            trendByPeriod={trendByPeriod}
            controller={controller}
            gridCompactShell={isAdmin}
          />
        )}
      </Suspense>
    </div>
  );
}
