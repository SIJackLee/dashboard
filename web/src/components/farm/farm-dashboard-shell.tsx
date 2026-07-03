"use client";

import { Suspense, useCallback, useMemo } from "react";
import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminFarmOverview } from "@/components/admin/admin-farm-overview";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import { FarmDrillStrip } from "@/components/farm/farm-drill-strip";
import { FarmContentSkeleton } from "@/components/common/loading-skeletons";
import { RefreshScopeShell } from "@/components/common/refresh-scope-shell";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { AdminFarmGridPanel } from "@/lib/farm/load-admin-all-farms-grid";
import {
  FarmLiveRefreshProvider,
  useFarmLiveRefresh,
} from "@/lib/navigation/farm-live-refresh";
import { useSoftRefresh } from "@/lib/ui/use-soft-refresh";

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
      allFarmGrids?: AdminFarmGridPanel[] | null;
    };

function AdminScopeBarWithRefresh({
  farmOptions,
  activeFarmKey,
  farmSummaries,
}: {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries: FarmSummaryRow[];
}) {
  const { revalidateFarmLive, revalidating, isStale } = useFarmLiveRefresh();
  const onScopeRefresh = useCallback(() => {
    void revalidateFarmLive();
  }, [revalidateFarmLive]);
  const {
    run: refreshScope,
    busy: scopeRefreshBusy,
    showProgress: scopeRefreshVisible,
  } = useSoftRefresh(onScopeRefresh);

  return (
    <RefreshScopeShell
      busy={scopeRefreshBusy || revalidating}
      showProgress={scopeRefreshVisible || isStale}
    >
      <ScopeBar
        sticky
        adminFarmSwitcher={{
          farmOptions,
          activeFarmKey,
          farmSummaries,
          compact: true,
        }}
        onRefresh={refreshScope}
        refreshBusy={scopeRefreshBusy || revalidating}
        refreshShowSpinner={scopeRefreshVisible || isStale}
      />
    </RefreshScopeShell>
  );
}

function FarmDashboardGridBody(
  props: Extract<FarmDashboardShellProps, { mapMode: "grid" }>,
) {
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

  const farmKey = useMemo((): FarmKey | null => {
    if (activeFarmKey) return activeFarmKey;
    return readings[0]?.farmKey ?? null;
  }, [activeFarmKey, readings]);

  const initialSlice = useMemo(
    () => ({
      readings,
      barnSnapshots,
      gridCols,
      gridRows,
      trendByPeriod,
      controller,
    }),
    [readings, barnSnapshots, gridCols, gridRows, trendByPeriod, controller],
  );

  return (
    <FarmLiveRefreshProvider farmKey={farmKey} initial={initialSlice}>
      <div className="space-y-4 md:space-y-5">
        {showAdminScope ? (
          <AdminScopeBarWithRefresh
            farmOptions={farmOptions}
            activeFarmKey={activeFarmKey}
            farmSummaries={farmSummaries}
          />
        ) : null}

        {isAdmin && activeFarmKey ? (
          <FarmDrillStrip
            activeFarmKey={activeFarmKey}
            sp={sp}
            view={view}
          />
        ) : null}

        <Suspense fallback={<FarmContentSkeleton view={view} />}>
          {adminAllFarmsMode ? (
            <AdminAllFarmsGridPanels panels={allFarmGrids ?? []} />
          ) : (
            <FarmLivePageContent gridCompactShell={isAdmin} />
          )}
        </Suspense>
      </div>
    </FarmLiveRefreshProvider>
  );
}

function FarmLivePageContent({
  gridCompactShell,
}: {
  gridCompactShell: boolean;
}) {
  const { slice, isStale } = useFarmLiveRefresh();

  return (
    <StaleWhileRevalidateShell stale={isStale}>
      <FarmPageContent
        readings={slice.readings}
        barnSnapshots={slice.barnSnapshots}
        gridCols={slice.gridCols}
        gridRows={slice.gridRows}
        trendByPeriod={slice.trendByPeriod}
        controller={slice.controller}
        gridCompactShell={gridCompactShell}
        liveRefreshManaged
      />
    </StaleWhileRevalidateShell>
  );
}

export function FarmDashboardShell(props: FarmDashboardShellProps) {
  if (props.mapMode === "geo") {
    return (
      <AdminFarmOverview farms={props.farms} locations={props.locations} />
    );
  }

  return <FarmDashboardGridBody {...props} />;
}
