"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { SimpleSelect } from "@/components/common/filter-bar";
import { BarnListSummary } from "@/components/farm/barn-list-summary";
import { BarnListModeToolbar } from "@/components/farm/barn-list-mode-toolbar";
import { BarnListTrendRefreshBar } from "@/components/farm/barn-list-trend-refresh-bar";
import { FarmMapBulkApply } from "@/components/farm/farm-map-bulk-apply";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  applyHubScopedViewParams,
  buildFarmPath,
  currentFarmSearchParams,
  parseListViewMode,
  replaceFarmUrlShallow,
  type BarnListViewMode,
} from "@/lib/farm/farm-view-url";
import {
  EMPTY_BARN_LIST_PANEL_SETS,
  toggleBarnListGraph,
  toggleBarnListMotor,
  toggleBarnListSettings,
  type BarnListPanelSets,
} from "@/lib/farm/barn-list-panel-state";
import { useFarmControllerTrend } from "@/lib/farm/use-farm-controller-trend";
import { formatStallTypeLabel, normalizeStallTyCode } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { FILTER_ALL, FILTER_ALL_LABEL, isFilterAll } from "@/lib/ui/filter-all";
import { cn } from "@/lib/utils";

type ListLayout = "group" | "flat";

type Props = {
  rows?: BarnReading[];
  controller?: ControllerGridData | null;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  initialSp?: string;
  initialListMode?: BarnListViewMode;
  initialListLayout?: ListLayout;
  compactHeader?: boolean;
  hubMode?: boolean;
  onHubUrlChange?: () => void;
};

function stallTyCodesFromReadings(readings: BarnReading[]): string[] {
  return [
    ...new Set(
      readings
        .map((r) => r.stallTyCode)
        .filter(Boolean)
        .map((code) => normalizeStallTyCode(code!)),
    ),
  ];
}

export function BarnTable({
  rows = [],
  controller = null,
  thermoSettings = {},
  alarmSettings,
  canCommand = false,
  initialSp,
  initialListMode,
  initialListLayout,
  compactHeader = false,
  hubMode = false,
  onHubUrlChange,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const liveParams = hubMode ? currentFarmSearchParams() : searchParams;
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [panelSets, setPanelSets] = useState<BarnListPanelSets>(
    EMPTY_BARN_LIST_PANEL_SETS
  );

  const bulkEnabled = Boolean(controller?.canCommand);

  const spOptions = useMemo(() => {
    const codes = stallTyCodesFromReadings(rows);
    return [
      { value: FILTER_ALL, label: FILTER_ALL_LABEL },
      ...codes.map((code) => ({
        value: code,
        label: formatStallTypeLabel(code),
      })),
    ];
  }, [rows]);

  const filterSp =
    initialSp && spOptions.some((o) => o.value === initialSp)
      ? initialSp
      : FILTER_ALL;

  const listLayout: ListLayout = hubMode
    ? (initialListLayout ?? "group")
    : liveParams.get("listLayout") === "flat"
      ? "flat"
      : "group";

  const listMode = hubMode
    ? (initialListMode ?? parseListViewMode(liveParams.get("listMode")))
    : parseListViewMode(liveParams.get("listMode"));
  const effectiveListMode: BarnListViewMode = bulkMode ? "controller" : listMode;
  const graphToolbarMode = effectiveListMode === "graph";
  const graphPanelsOpen = panelSets.graphKeys.size > 0;
  const farmKey = rows[0]?.farmKey ?? null;
  const trendEnabled =
    (graphToolbarMode || graphPanelsOpen) && Boolean(farmKey);

  const {
    data: lazyControllerTrend,
    loading: trendLoading,
    error: trendError,
    refresh: refreshTrend,
  } = useFarmControllerTrend({
    farmKey,
    enabled: trendEnabled,
  });

  const controllerTrendByPeriod = trendEnabled ? lazyControllerTrend : null;

  const toggleGraphPanel = useCallback((key: string) => {
    setPanelSets((prev) => toggleBarnListGraph(prev, key));
  }, []);

  const toggleSettingsPanel = useCallback((key: string) => {
    setPanelSets((prev) => toggleBarnListSettings(prev, key));
  }, []);

  const toggleMotorPanel = useCallback((key: string) => {
    setPanelSets((prev) => toggleBarnListMotor(prev, key));
  }, []);

  const filteredRows = useMemo(() => {
    if (isFilterAll(filterSp)) return rows;
    return rows.filter((r) => r.stallTyCode === filterSp);
  }, [rows, filterSp]);

  const visibleSpCodes = useMemo(
    () => stallTyCodesFromReadings(filteredRows),
    [filteredRows],
  );

  const replaceListParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(
        (hubMode ? currentFarmSearchParams() : searchParams).toString(),
      );
      if (hubMode) {
        applyHubScopedViewParams(params, "list");
      } else {
        params.set("view", "list");
      }
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (hubMode) {
        replaceFarmUrlShallow(params);
        onHubUrlChange?.();
        return;
      }
      router.replace(buildFarmPath(params), { scroll: false });
    },
    [hubMode, onHubUrlChange, router, searchParams],
  );

  const handleSpChange = (value: string | null) => {
    if (bulkMode) return;
    if (!value || isFilterAll(value)) {
      replaceListParams({ sp: null });
      return;
    }
    replaceListParams({ sp: value });
  };

  const toggleListLayout = () => {
    if (bulkMode) return;
    replaceListParams({
      listLayout: listLayout === "group" ? "flat" : null,
    });
  };

  const handleListModeChange = (mode: BarnListViewMode) => {
    if (bulkMode) return;
    setPanelSets(EMPTY_BARN_LIST_PANEL_SETS);
    replaceListParams({
      listMode: mode === "controller" ? null : mode,
    });
  };

  const toggleSp = useCallback((sp: string) => {
    const code = normalizeStallTyCode(sp);
    setSelectedSps((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const enterBulk = useCallback(() => {
    setBulkMode(true);
    setSelectedSps(new Set(visibleSpCodes));
  }, [visibleSpCodes]);

  const exitBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedSps(new Set());
  }, []);

  return (
    <SectionCard
      title={compactHeader ? "축사 목록 (요약)" : "축사 목록"}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            placeholder={FILTER_ALL_LABEL}
            options={spOptions}
            value={filterSp}
            onValueChange={handleSpChange}
          />
          <PageActionButton
            icon={
              listLayout === "group" ? (
                <LayoutGrid className={dashboardUi.iconSm} aria-hidden />
              ) : (
                <LayoutList className={dashboardUi.iconSm} aria-hidden />
              )
            }
            onClick={toggleListLayout}
            disabled={bulkMode}
          >
            {listLayout === "group" ? "일반 보기" : "그룹별 보기"}
          </PageActionButton>
          <BarnListModeToolbar
            value={effectiveListMode}
            onChange={handleListModeChange}
            disabled={bulkMode}
          />
        </div>
      }
      contentClassName={bulkEnabled ? "flex flex-col gap-0 p-0" : undefined}
    >
      {bulkEnabled && controller ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={enterBulk}
          onClearSelection={() => setSelectedSps(new Set())}
          onExit={exitBulk}
          hubMode={hubMode}
        />
      ) : null}
      {graphToolbarMode || graphPanelsOpen ? (
        <div
          className={cn(
            bulkEnabled && "px-4 md:px-6",
            bulkEnabled && !bulkMode && "pt-4 md:pt-6",
          )}
        >
          <BarnListTrendRefreshBar
            onRefresh={() => {
              refreshTrend();
              if (!hubMode) router.refresh();
            }}
            loading={trendLoading}
            error={trendError}
          />
        </div>
      ) : null}
      <div
        className={cn(
          bulkEnabled && "px-4 pb-4 md:px-6 md:pb-6",
          bulkMode && "data-[bulk=list]",
        )}
        data-bulk={bulkMode ? "list" : undefined}
      >
        <BarnListSummary
          readings={filteredRows}
          thermoSettings={thermoSettings}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          layout={listLayout}
          listMode={effectiveListMode}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          panelSets={panelSets}
          onToggleGraph={toggleGraphPanel}
          onToggleSettings={toggleSettingsPanel}
          onToggleMotor={toggleMotorPanel}
          bulkMode={bulkMode}
          selectedSps={selectedSps}
          onToggleSp={toggleSp}
        />
      </div>
    </SectionCard>
  );
}
