"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/farm/barn-table";
import {
  applyHubScopedViewParams,
  currentFarmSearchParams,
  parseMapDrillLevel,
  replaceFarmUrlShallow,
  resolveListViewMode,
} from "@/lib/farm/farm-view-url";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { fetchFarmScopedPanelDataAction } from "@/app/(dashboard)/farm/actions";
import {
  readFarmPanelCache,
  useFarmLiveRefreshOptional,
} from "@/lib/navigation/farm-live-refresh";
import { FarmListSkeleton } from "@/components/common/loading-skeletons";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  hideViewTabs?: boolean;
  deepLinkSp?: string | null;
  deepLinkStallNo?: string | null;
  deepLinkMapLevel?: "sp" | "stalls";
  hubUrlEpoch?: number;
  onHubUrlChange?: () => void;
  gridCompactShell?: boolean;
  liveRefreshManaged?: boolean;
  /** hub 캐시 단일 농장 — 목록 탭 첫 진입 시 scoped panel 보강 */
  lazyListEnrichment?: boolean;
  /** SSR과 일치하는 초기 그리드/목록 탭 (hubMode) */
  initialHubView?: "map" | "list";
  lazyListFarmKey?: FarmKey | null;
};

export function FarmPageContent({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
  trendByPeriod,
  controller,
  hubMode = false,
  hideViewTabs = false,
  deepLinkSp: deepLinkSpProp,
  deepLinkStallNo: deepLinkStallNoProp,
  deepLinkMapLevel: deepLinkMapLevelProp,
  hubUrlEpoch = 0,
  onHubUrlChange,
  gridCompactShell = false,
  liveRefreshManaged = false,
  lazyListEnrichment = false,
  lazyListFarmKey = null,
  initialHubView,
}: Props) {
  const searchParams = useSearchParams();
  const liveRefresh = useFarmLiveRefreshOptional();
  const liveRefreshRef = useRef(liveRefresh);
  liveRefreshRef.current = liveRefresh;
  const enrichFarmRef = useRef<string | null>(null);
  const [listEnriching, setListEnriching] = useState(false);
  const liveParams = hubMode ? currentFarmSearchParams() : searchParams;
  const bootstrapHubView: "map" | "list" =
    initialHubView ??
    (hubMode && liveParams.get("view") === "list" ? "list" : "map");
  const [hubView, setHubView] = useState<"map" | "list">(bootstrapHubView);
  const [listEverOpened, setListEverOpened] = useState(
    bootstrapHubView === "list",
  );

  useEffect(() => {
    if (!hubMode) return;
    const next = currentFarmSearchParams().get("view") === "list" ? "list" : "map";
    setHubView(next);
    if (next === "list") setListEverOpened(true);
  }, [hubMode, hubUrlEpoch]);

  const view = hubMode
    ? hubView
    : searchParams.get("view") === "list"
      ? "list"
      : "map";

  useEffect(() => {
    if (view === "list") setListEverOpened(true);
  }, [view]);

  const mapSpRaw =
    deepLinkSpProp !== undefined
      ? deepLinkSpProp
      : view === "map"
        ? liveParams.get("sp")
        : null;
  const mapSp = mapSpRaw ? normalizeStallTyCode(mapSpRaw) : undefined;
  const mapLevel =
    deepLinkMapLevelProp ??
    (view === "map" ? parseMapDrillLevel(liveParams.get("mapLevel")) : "sp");
  const urlStall = liveParams.get("stall") ?? undefined;
  const urlCtrl = liveParams.get("ctrl");
  const mapStall =
    deepLinkStallNoProp !== undefined
      ? deepLinkStallNoProp ?? undefined
      : view === "map" && hubMode && urlCtrl
        ? urlStall
        : view === "map"
          ? urlStall
          : undefined;
  const listSp = view === "list" ? liveParams.get("sp") ?? undefined : undefined;
  const listMode = useMemo(() => {
    const params = hubMode ? currentFarmSearchParams() : searchParams;
    return resolveListViewMode(params, "controller");
  }, [hubMode, hubUrlEpoch, searchParams]);
  const listLayout =
    liveParams.get("listLayout") === "flat" ? ("flat" as const) : ("group" as const);
  const thermoSettings = controller?.thermoSettings ?? {};
  const alarmSettings = controller?.alarmSettings;

  const enrichListIfNeeded = useCallback(async () => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;

    const lr = liveRefreshRef.current;
    if (!lr) return;

    const sliceController = lr.slice.controller;
    const hasThermo =
      Object.keys(sliceController?.thermoSettings ?? {}).length > 0;
    if (sliceController?.alarmSettings && hasThermo) return;

    const farmId = farmKeyId(lazyListFarmKey);
    const cached = readFarmPanelCache(farmId);
    const cachedHasThermo =
      Object.keys(cached?.controller?.thermoSettings ?? {}).length > 0;
    if (cached?.controller?.alarmSettings && cachedHasThermo) {
      lr.hydrateScopedPanel(cached);
      return;
    }

    setListEnriching(true);
    try {
      const data = await fetchFarmScopedPanelDataAction(lazyListFarmKey);
      liveRefreshRef.current?.hydrateScopedPanel(data);
    } catch {
      // 목록은 grid readings로 제한 표시
    } finally {
      setListEnriching(false);
    }
  }, [lazyListEnrichment, lazyListFarmKey]);

  useEffect(() => {
    enrichFarmRef.current = null;
  }, [lazyListFarmKey]);

  useEffect(() => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;

    const farmId = farmKeyId(lazyListFarmKey);
    if (enrichFarmRef.current === farmId) return;
    const hasThermo =
      Object.keys(liveRefresh?.slice.controller?.thermoSettings ?? {}).length > 0;
    if (liveRefresh?.slice.controller?.alarmSettings && hasThermo) {
      enrichFarmRef.current = farmId;
      return;
    }

    enrichFarmRef.current = farmId;
    void enrichListIfNeeded();
  }, [
    lazyListEnrichment,
    lazyListFarmKey,
    liveRefresh?.slice.controller?.alarmSettings,
    liveRefresh?.slice.controller?.thermoSettings,
    enrichListIfNeeded,
  ]);

  const applyViewChange = useCallback(
    (next: "map" | "list") => {
      if (next === "list") {
        setListEverOpened(true);
        void enrichListIfNeeded();
      }
      if (hubMode) {
        setHubView(next);
        const params = new URLSearchParams(currentFarmSearchParams().toString());
        applyHubScopedViewParams(params, next);
        replaceFarmUrlShallow(params);
        onHubUrlChange?.();
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next === "list") {
        params.set("view", "list");
      } else {
        params.delete("view");
        params.delete("listMode");
      }
      replaceFarmUrlShallow(params);
    },
    [hubMode, onHubUrlChange, searchParams, enrichListIfNeeded]
  );

  const setView = useCallback(
    (next: "map" | "list") => {
      flushSync(() => {
        applyViewChange(next);
      });
    },
    [applyViewChange]
  );

  const tabNavClass = gridCompactShell
    ? "text-sm font-medium md:text-sm"
    : dashboardUi.tabNav;

  const mapHidden = view !== "map";
  const listHidden = view !== "list";
  const panelInactive =
    "pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden opacity-0";
  const panelActive = "opacity-100 transition-opacity duration-150 ease-out";

  return (
    <div className="space-y-4">
      {!hideViewTabs ? (
        <div
          className={cn(
            "inline-flex rounded-xl border bg-muted/20 p-1",
            gridCompactShell ? "text-sm md:text-sm" : dashboardUi.body
          )}
          role="tablist"
          aria-label="농장 보기"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
              tabNavClass,
              view === "map"
                ? "bg-background text-foreground shadow-sm dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("map")}
          >
            <Map className={dashboardUi.iconSm} aria-hidden />
            그리드
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
              tabNavClass,
              view === "list"
                ? "bg-background text-foreground shadow-sm dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("list")}
          >
            <List className={dashboardUi.iconSm} aria-hidden />
            목록
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0" data-farm-view-slot>
        <div
          className={cn(
            "min-h-0 lg:min-h-[16rem]",
            panelActive,
            mapHidden && panelInactive
          )}
          aria-hidden={mapHidden}
          inert={mapHidden ? true : undefined}
          data-farm-view-panel="map"
          data-farm-view-active={!mapHidden}
        >
          <FarmMapView
            barns={barnSnapshots}
            readings={readings}
            gridCols={gridCols}
            gridRows={gridRows}
            trendByPeriod={trendByPeriod}
            trendStatus="ready"
            controller={controller}
            hubMode={hubMode}
            compactShell={gridCompactShell}
            uniformGridLayout={gridCompactShell}
            deepLinkSp={mapSp ?? null}
            deepLinkMapLevel={mapLevel}
            deepLinkStallNo={mapStall ?? null}
          />
        </div>

        {listEverOpened ? (
          <div
            className={cn(panelActive, listHidden && panelInactive)}
            aria-hidden={listHidden}
            inert={listHidden ? true : undefined}
            data-farm-view-panel="list"
            data-farm-view-active={!listHidden}
          >
            {listEnriching ? (
              <FarmListSkeleton />
            ) : (
              <BarnTable
                rows={readings}
                controller={controller ?? null}
                thermoSettings={thermoSettings}
                alarmSettings={alarmSettings}
                canCommand={controller?.canCommand ?? false}
                initialSp={listSp}
                initialListMode={listMode}
                initialListLayout={listLayout}
                hubMode={hubMode}
                onHubUrlChange={onHubUrlChange}
                liveRefreshManaged={liveRefreshManaged}
                staggerMount
                onRequestPanelEnrichment={enrichListIfNeeded}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
