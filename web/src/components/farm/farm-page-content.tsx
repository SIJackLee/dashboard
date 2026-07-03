"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/farm/barn-table";
import {
  applyHubScopedViewParams,
  applyListViewParams,
  applyMapGridParams,
  buildFarmPath,
  currentFarmSearchParams,
  parseListViewMode,
  parseMapDrillLevel,
  replaceFarmUrlShallow,
  type BarnListViewMode,
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
  /** Admin farm grid — SectionCard·탭을 카드 스케일에 맞춤 */
  gridCompactShell?: boolean;
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
  hubUrlEpoch: _hubUrlEpoch = 0,
  onHubUrlChange,
  gridCompactShell = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const liveParams = hubMode ? currentFarmSearchParams() : searchParams;
  const [hubView, setHubView] = useState<"map" | "list">(() =>
    hubMode && liveParams.get("view") === "list" ? "list" : "map"
  );

  useEffect(() => {
    if (!hubMode) return;
    setHubView(liveParams.get("view") === "list" ? "list" : "map");
  }, [hubMode, liveParams.get("lsind"), liveParams.get("item"), liveParams.get("view")]);

  const view = hubMode
    ? hubView
    : searchParams.get("view") === "list"
      ? "list"
      : "map";
  /** view=map 일 때만 — 축사유형 그래프 drill */
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
  /** view=list 일 때 SP 필터 */
  const listSp = view === "list" ? liveParams.get("sp") ?? undefined : undefined;
  const listMode = parseListViewMode(liveParams.get("listMode"));
  const listLayout =
    liveParams.get("listLayout") === "flat" ? ("flat" as const) : ("group" as const);
  const thermoSettings = controller?.thermoSettings ?? {};
  const alarmSettings = controller?.alarmSettings;

  const setView = (next: "map" | "list") => {
    if (hubMode) {
      setHubView(next);
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyHubScopedViewParams(params, next);
      replaceFarmUrlShallow(params);
      onHubUrlChange?.();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") applyListViewParams(params);
    else applyMapGridParams(params);
    router.replace(buildFarmPath(params), { scroll: false });
  };

  const tabNavClass = gridCompactShell
    ? "text-sm font-medium md:text-sm"
    : dashboardUi.tabNav;

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
                ? "bg-background text-foreground shadow-sm"
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
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("list")}
          >
            <List className={dashboardUi.iconSm} aria-hidden />
            목록
          </button>
        </div>
      ) : null}

      {view === "map" ? (
        <div className="min-h-0 lg:min-h-[16rem]">
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
        />
      )}
    </div>
  );
}
