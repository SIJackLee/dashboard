"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import {
  AdminHubGridSkeleton,
  FarmContentSkeleton,
} from "@/components/common/loading-skeletons";
import { RefreshScopeShell } from "@/components/common/refresh-scope-shell";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import { NavContentReadyMarker } from "@/components/layout/nav-content-ready-marker";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { currentFarmSearchParams } from "@/lib/farm/farm-view-url";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import {
  FarmLiveRefreshProvider,
  useFarmLiveRefresh,
  type FarmLiveSlice,
} from "@/lib/navigation/farm-live-refresh";
import { useSoftRefresh } from "@/lib/ui/use-soft-refresh";

export type FarmDashboardShellProps = {
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
  deferAdminGridLoad?: boolean;
  children?: ReactNode;
};

function sliceFromAdminPanel(
  panel: AdminFarmGridPanel,
  canCommand: boolean,
): FarmLiveSlice {
  return {
    readings: panel.readings,
    barnSnapshots: panel.barnSnapshots,
    gridCols: panel.gridCols,
    gridRows: panel.gridRows,
    trendByPeriod: null,
    controller: {
      readings: panel.readings,
      thermoSettings: {},
      commands: [],
      canCommand,
    },
  };
}

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

function FarmLivePageContent({
  gridCompactShell,
  hubUrlEpoch,
  onHubUrlChange,
  lazyListEnrichment = false,
  lazyListFarmKey = null,
  initialHubView,
}: {
  gridCompactShell: boolean;
  hubUrlEpoch: number;
  onHubUrlChange: () => void;
  lazyListEnrichment?: boolean;
  lazyListFarmKey?: FarmKey | null;
  initialHubView?: "map" | "list";
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
        hubMode
        hubUrlEpoch={hubUrlEpoch}
        onHubUrlChange={onHubUrlChange}
        lazyListEnrichment={lazyListEnrichment}
        lazyListFarmKey={lazyListFarmKey}
        initialHubView={initialHubView}
      />
    </StaleWhileRevalidateShell>
  );
}

function AdminHubBody({
  deferAdminGridLoad,
  children,
  allFarmGrids,
  view,
  isAdmin,
  hubUrlEpoch,
  onHubUrlChange,
  serverActiveFarmKey,
}: {
  deferAdminGridLoad: boolean;
  children?: ReactNode;
  allFarmGrids: AdminFarmGridPanel[] | null;
  view?: string | null;
  isAdmin: boolean;
  hubUrlEpoch: number;
  onHubUrlChange: () => void;
  serverActiveFarmKey: FarmKey | null;
}) {
  const { panels, ready, getPanelByFarmKey, hubUrlEpoch: ctxEpoch } =
    useAdminHubPanels();

  const hubClientNav = ready && panels.length > 0;

  const clientActiveFarmKey = useMemo((): FarmKey | null => {
    if (!hubClientNav) return serverActiveFarmKey;
    return parseFarmKeyFromQuery(
      currentFarmSearchParams().get("lsind"),
      currentFarmSearchParams().get("item"),
    );
  }, [hubClientNav, serverActiveFarmKey, hubUrlEpoch, ctxEpoch]);

  const cachedPanel = clientActiveFarmKey
    ? getPanelByFarmKey(clientActiveFarmKey)
    : undefined;

  const gridFallback = deferAdminGridLoad ? (
    <AdminHubGridSkeleton />
  ) : (
    <FarmContentSkeleton view={view} />
  );

  if (hubClientNav) {
    if (!clientActiveFarmKey) {
      return <AdminAllFarmsGridPanels panels={panels} />;
    }
    if (cachedPanel) {
      return (
        <FarmLivePageContent
          gridCompactShell={isAdmin}
          hubUrlEpoch={hubUrlEpoch}
          onHubUrlChange={onHubUrlChange}
          lazyListEnrichment
          lazyListFarmKey={clientActiveFarmKey}
          initialHubView={view === "list" ? "list" : "map"}
        />
      );
    }
    return (
      <FarmLivePageContent
        gridCompactShell={isAdmin}
        hubUrlEpoch={hubUrlEpoch}
        onHubUrlChange={onHubUrlChange}
        initialHubView={view === "list" ? "list" : "map"}
      />
    );
  }

  const adminAllFarmsMode = !serverActiveFarmKey;

  return (
    <Suspense fallback={gridFallback}>
      {adminAllFarmsMode ? (
        deferAdminGridLoad ? (
          children
        ) : (
          <AdminAllFarmsGridPanels panels={allFarmGrids ?? []} />
        )
      ) : (
        <FarmLivePageContent
          gridCompactShell={isAdmin}
          hubUrlEpoch={hubUrlEpoch}
          onHubUrlChange={onHubUrlChange}
          initialHubView={view === "list" ? "list" : "map"}
        />
      )}
    </Suspense>
  );
}

export function FarmDashboardShell({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
  isAdmin = false,
  farmOptions = [],
  activeFarmKey: serverActiveFarmKey = null,
  farmSummaries = [],
  sp,
  view,
  trendByPeriod,
  controller,
  allFarmGrids = null,
  deferAdminGridLoad = false,
  children,
}: FarmDashboardShellProps) {
  const { ready, getPanelByFarmKey, hubUrlEpoch: ctxEpoch, notifyHubUrlChange } =
    useAdminHubPanels();

  const showAdminScope = isAdmin && farmOptions.length > 0;
  const hubClientNav = isAdmin && ready && farmOptions.length > 0;

  const [localHubEpoch, setLocalHubEpoch] = useState(0);
  useEffect(() => {
    const sync = () => {
      setLocalHubEpoch((n) => n + 1);
      notifyHubUrlChange();
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [notifyHubUrlChange]);

  const hubUrlEpoch = localHubEpoch + ctxEpoch;

  const clientActiveFarmKey = useMemo((): FarmKey | null => {
    if (!hubClientNav) return serverActiveFarmKey;
    return parseFarmKeyFromQuery(
      currentFarmSearchParams().get("lsind"),
      currentFarmSearchParams().get("item"),
    );
  }, [hubClientNav, serverActiveFarmKey, hubUrlEpoch]);

  const scopeActiveFarmKey = hubClientNav
    ? clientActiveFarmKey
    : serverActiveFarmKey;

  const cachedPanel = clientActiveFarmKey
    ? getPanelByFarmKey(clientActiveFarmKey)
    : undefined;

  const useCachedSingle = Boolean(
    hubClientNav && clientActiveFarmKey && cachedPanel,
  );

  const adminAllFarmsMode =
    isAdmin && !scopeActiveFarmKey && farmOptions.length > 0;

  const farmKey = useMemo((): FarmKey | null => {
    if (useCachedSingle && clientActiveFarmKey) return clientActiveFarmKey;
    if (serverActiveFarmKey) return serverActiveFarmKey;
    if (adminAllFarmsMode) return null;
    return readings[0]?.farmKey ?? null;
  }, [
    useCachedSingle,
    clientActiveFarmKey,
    serverActiveFarmKey,
    adminAllFarmsMode,
    readings,
  ]);

  const canCommand = controller?.canCommand ?? false;

  const initialSlice = useMemo((): FarmLiveSlice => {
    if (useCachedSingle && cachedPanel) {
      return sliceFromAdminPanel(cachedPanel, canCommand);
    }
    return {
      readings,
      barnSnapshots,
      gridCols,
      gridRows,
      trendByPeriod,
      controller,
    };
  }, [
    useCachedSingle,
    cachedPanel,
    canCommand,
    readings,
    barnSnapshots,
    gridCols,
    gridRows,
    trendByPeriod,
    controller,
  ]);

  const onHubUrlChange = useCallback(() => {
    setLocalHubEpoch((n) => n + 1);
    notifyHubUrlChange();
  }, [notifyHubUrlChange]);

  return (
    <FarmLiveRefreshProvider farmKey={farmKey} initial={initialSlice}>
      <NavContentReadyMarker />
      <div className="space-y-4 md:space-y-5">
        {showAdminScope ? (
          <AdminScopeBarWithRefresh
            farmOptions={farmOptions}
            activeFarmKey={scopeActiveFarmKey}
            farmSummaries={farmSummaries}
          />
        ) : null}

        {isAdmin && deferAdminGridLoad ? (
          <AdminHubBody
            deferAdminGridLoad={deferAdminGridLoad}
            allFarmGrids={allFarmGrids}
            view={view}
            isAdmin={isAdmin}
            hubUrlEpoch={hubUrlEpoch}
            onHubUrlChange={onHubUrlChange}
            serverActiveFarmKey={serverActiveFarmKey}
          >
            {children}
          </AdminHubBody>
        ) : (
          <Suspense
            fallback={
              deferAdminGridLoad ? (
                <AdminHubGridSkeleton />
              ) : (
                <FarmContentSkeleton view={view} />
              )
            }
          >
            {adminAllFarmsMode && !useCachedSingle ? (
              deferAdminGridLoad ? (
                children
              ) : (
                <AdminAllFarmsGridPanels panels={allFarmGrids ?? []} />
              )
            ) : (
              <FarmLivePageContent
                gridCompactShell={isAdmin}
                hubUrlEpoch={hubUrlEpoch}
                onHubUrlChange={onHubUrlChange}
                lazyListEnrichment={useCachedSingle}
                lazyListFarmKey={clientActiveFarmKey}
                initialHubView={view === "list" ? "list" : "map"}
              />
            )}
          </Suspense>
        )}
      </div>
    </FarmLiveRefreshProvider>
  );
}
