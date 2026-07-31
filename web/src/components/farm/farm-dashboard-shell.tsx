"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminHubGridTailLoader } from "@/components/farm/admin-hub-grid-tail-loader";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import {
  AdminHubGridSkeleton,
  FarmContentSkeleton,
} from "@/components/common/loading-skeletons";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import { NavContentReadyMarker } from "@/components/layout/nav-content-ready-marker";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import type { BarnLayoutsToPersist } from "@/lib/farm/load-farm-scoped-panel-data";
import { currentFarmSearchParams, resolveFarmHubView } from "@/lib/farm/farm-view-url";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import {
  FarmLiveRefreshProvider,
  useFarmLiveRefresh,
  type FarmLiveSlice,
} from "@/lib/navigation/farm-live-refresh";

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
  layoutsToPersist?: BarnLayoutsToPersist;
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

function AdminScopeBar({
  farmOptions,
  activeFarmKey,
  farmSummaries,
}: {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries: FarmSummaryRow[];
}) {
  return (
    <ScopeBar
      sticky
      adminFarmSwitcher={{
        farmOptions,
        activeFarmKey,
        farmSummaries,
        compact: true,
      }}
    />
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
  initialHubView?: ReturnType<typeof resolveFarmHubView>;
}) {
  const { slice, isStale, isBootstrapping } = useFarmLiveRefresh();

  if (isBootstrapping) {
    return (
      <FarmContentSkeleton
        view={initialHubView === "list" ? "list" : undefined}
      />
    );
  }

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
  // hubUrlEpoch/ctxEpoch: URL shallow 변경 시 재파싱 트리거
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 포함
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
      return (
        <>
          <AdminAllFarmsGridPanels panels={panels} liveFromContext />
          <AdminHubGridTailLoader />
        </>
      );
    }
    if (cachedPanel) {
      return (
        <FarmLivePageContent
          gridCompactShell={isAdmin}
          hubUrlEpoch={hubUrlEpoch}
          onHubUrlChange={onHubUrlChange}
          lazyListEnrichment
          lazyListFarmKey={clientActiveFarmKey}
          initialHubView={resolveFarmHubView(view)}
        />
      );
    }
    return (
      <FarmLivePageContent
        gridCompactShell={isAdmin}
        hubUrlEpoch={hubUrlEpoch}
        onHubUrlChange={onHubUrlChange}
        initialHubView={resolveFarmHubView(view)}
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
          initialHubView={resolveFarmHubView(view)}
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
  sp: _sp,
  view,
  trendByPeriod,
  controller,
  layoutsToPersist,
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
  // hubUrlEpoch: shallow URL 변경 시 재파싱 트리거
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 포함
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
      layoutsToPersist,
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
    layoutsToPersist,
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
          <AdminScopeBar
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
                initialHubView={resolveFarmHubView(view)}
              />
            )}
          </Suspense>
        )}
      </div>
    </FarmLiveRefreshProvider>
  );
}
