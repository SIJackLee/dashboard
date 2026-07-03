"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
}: Props) {
  const searchParams = useSearchParams();
  const liveParams = hubMode ? currentFarmSearchParams() : searchParams;
  const [hubView, setHubView] = useState<"map" | "list">(() =>
    hubMode && liveParams.get("view") === "list" ? "list" : "map"
  );
  const [listEverOpened, setListEverOpened] = useState(
    () => hubMode && liveParams.get("view") === "list"
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

  const applyViewChange = useCallback(
    (next: "map" | "list") => {
      if (next === "list") setListEverOpened(true);
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
    [hubMode, onHubUrlChange, searchParams]
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
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
