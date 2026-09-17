"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import { buildSharedWidgetBrushOverview } from "@/components/farm/unified-barn-trend-panel-helpers";
import {
  BRUSH_PERIOD_WINDOW,
  UnifiedTrendPeriodBrush,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
  isContextControllerTrend30d,
  type TrendControllerPeriodData,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  chartScopeLabel,
  dismissFarmChartLabHero,
  EMPTY_FARM_CHART_LAB_SELECTION,
  farmChartLabControllerScopes,
  farmChartLabScopeKey,
  farmChartLabSelectionFromKeys,
  filterReadingsByChartScope,
  type FarmChartControllerScope,
  type FarmChartLabMode,
  type FarmChartLabSelection,
} from "@/lib/farm/farm-chart-scope";
import {
  coverageIndexesFromSnap,
  useFarmTrendUplinkCoverage,
} from "@/lib/farm/use-farm-trend-uplink-coverage";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardAffordance,
  dashboardChroma,
  dashboardElevation,
  dashboardHubSurface,
  dashboardTypography,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

export type { FarmChartLabMode };

type Props = {
  readings: BarnReading[];
  farmKey?: FarmKey | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  period: TrendPeriodId;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 차트 탭 — `chartW1`/`chartW2` 선택 */
  selection?: FarmChartLabSelection;
  onSelectionChange?: (next: FarmChartLabSelection) => void;
  layersToolbarActive?: boolean;
};

function labBatchListClass(compact: boolean): string {
  if (compact) return "grid grid-cols-2 content-start gap-2.5";
  return "flex flex-wrap content-start gap-2.5 md:gap-3";
}

export function FarmChartLabView({
  readings,
  farmKey,
  controllerTrendByPeriod,
  trendLoading = false,
  trendError = false,
  trendExtending = false,
  window15mLoading = false,
  window15m = null,
  onNeedWindow15m,
  period,
  alarmSettings,
  thermoSettings,
  canCommand = false,
  isMobileStack = false,
  selection,
  onSelectionChange,
  layersToolbarActive = true,
}: Props) {
  const scopes = useMemo(
    () => farmChartLabControllerScopes(readings),
    [readings],
  );
  const [localMode, setLocalMode] = useState<FarmChartLabMode>("batch");
  const [localPrimaryKey, setLocalPrimaryKey] = useState<string | null>(null);
  const [localPartnerKey, setLocalPartnerKey] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const urlBound = typeof onSelectionChange === "function";
  const storedMode = urlBound ? (selection?.mode ?? "batch") : localMode;
  const primaryKey = urlBound
    ? selection?.primary
      ? farmChartLabScopeKey(selection.primary)
      : null
    : localPrimaryKey;
  const partnerKey = urlBound
    ? selection?.partner
      ? farmChartLabScopeKey(selection.partner)
      : null
    : localPartnerKey;
  if (urlBound && storedMode === "compare" && picking) {
    setPicking(false);
  }
  const mode: FarmChartLabMode = picking ? "compare" : storedMode;
  const [sharedBrushWindow, setSharedBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW[period],
  );
  const [sharedBrushPeriod, setSharedBrushPeriod] = useState(period);
  if (period !== sharedBrushPeriod) {
    setSharedBrushPeriod(period);
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW[period]);
  }

  const modeGroupRef = useRef<HTMLDivElement>(null);
  const [modePill, setModePill] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const root = modeGroupRef.current;
    if (!root) return;
    const sync = () => {
      const selected = root.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      if (!selected) return;
      const next = { left: selected.offsetLeft, width: selected.offsetWidth };
      setModePill((prev) =>
        prev.left === next.left && prev.width === next.width ? prev : next,
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    return () => ro.disconnect();
  }, [mode, primaryKey, isMobileStack]);

  const uplinkCoverageSnap = useFarmTrendUplinkCoverage({
    farmKey: farmKey ?? null,
    enabled: true,
    h24: controllerTrendByPeriod?.["24h"],
    d30: controllerTrendByPeriod?.["30d"],
    window15m,
  });
  const uplinkCoverage = coverageIndexesFromSnap(uplinkCoverageSnap);

  const useSharedBrush = isContextControllerTrend30d(
    controllerTrendByPeriod?.["30d"],
  );
  const sharedBrushOverview = useMemo(
    () =>
      buildSharedWidgetBrushOverview(
        [],
        [],
        readings.map((r) => ({ reading: r })),
        controllerTrendByPeriod,
        alarmSettings,
      ),
    [readings, controllerTrendByPeriod, alarmSettings],
  );

  const restCount = scopes.filter(
    (s) => farmChartLabScopeKey(s) !== primaryKey,
  ).length;

  const commitSelection = (next: FarmChartLabSelection) => {
    if (onSelectionChange) {
      onSelectionChange(next);
      return;
    }
    setLocalMode(next.mode);
    setLocalPrimaryKey(
      next.primary ? farmChartLabScopeKey(next.primary) : null,
    );
    setLocalPartnerKey(
      next.partner ? farmChartLabScopeKey(next.partner) : null,
    );
  };

  const scopeByKey = (key: string | null) =>
    key
      ? (scopes.find((s) => farmChartLabScopeKey(s) === key) ?? null)
      : null;

  const openBatch = () => {
    setPicking(false);
    if (urlBound) {
      onSelectionChange?.(EMPTY_FARM_CHART_LAB_SELECTION);
      return;
    }
    setLocalMode("batch");
  };
  const openSingle = (scope: FarmChartControllerScope) => {
    setPicking(false);
    if (urlBound) {
      commitSelection({ mode: "single", primary: scope, partner: null });
      return;
    }
    const key = farmChartLabScopeKey(scope);
    setLocalPrimaryKey(key);
    if (localPartnerKey === key) setLocalPartnerKey(null);
    setLocalMode("single");
  };
  const openCompare = () => {
    if (storedMode === "batch" || !primaryKey || restCount === 0) return;
    if (urlBound) {
      setPicking(!partnerKey);
      return;
    }
    setLocalMode("compare");
    setPicking(!localPartnerKey);
  };
  const takePartner = (scope: FarmChartControllerScope) => {
    const key = farmChartLabScopeKey(scope);
    if (key === primaryKey) return;
    setPicking(false);
    if (urlBound) {
      const primary = selection?.primary ?? scopeByKey(primaryKey);
      if (!primary) return;
      commitSelection({ mode: "compare", primary, partner: scope });
      return;
    }
    setLocalPartnerKey(key);
    setLocalMode("compare");
  };
  const dismissHero = (scope: FarmChartControllerScope) => {
    const next = dismissFarmChartLabHero({
      dismissedKey: farmChartLabScopeKey(scope),
      primaryKey,
      partnerKey,
    });
    setPicking(false);
    if (urlBound) {
      commitSelection(farmChartLabSelectionFromKeys(scopes, next));
      return;
    }
    setLocalPrimaryKey(next.primaryKey);
    setLocalPartnerKey(next.partnerKey);
    setLocalMode(next.mode);
  };

  const showStoredSingle = () => {
    if (!primaryKey) return;
    setPicking(false);
    if (urlBound) {
      const primary = selection?.primary ?? scopeByKey(primaryKey);
      if (!primary) return;
      commitSelection({ mode: "single", primary, partner: null });
      return;
    }
    setLocalMode("single");
  };

  const isHero = (scope: FarmChartControllerScope) => {
    const key = farmChartLabScopeKey(scope);
    if (mode === "batch") return false;
    if (key === primaryKey) return true;
    return mode === "compare" && Boolean(partnerKey) && !picking && key === partnerKey;
  };

  const modeBtn = (active: boolean) =>
    cn(
      "relative z-[1] inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium",
      motionClass.microInteractive,
      active
        ? dashboardChroma.chromeActiveText
        : dashboardAffordance.choiceIdle,
    );

  const renderTile = (
    scope: FarmChartControllerScope,
    size: "cell" | "hero" | "peer",
    index = 0,
  ) => {
    const key = farmChartLabScopeKey(scope);
    const selected =
      size === "hero" &&
      (key === primaryKey ||
        (mode === "compare" && key === partnerKey && !picking));
    const action =
      mode === "batch"
        ? { label: "이 칸만 보기", onClick: () => openSingle(scope) }
        : size === "peer" && mode === "single"
          ? { label: "이 대로 보기", onClick: () => openSingle(scope) }
          : size === "peer" && mode === "compare"
            ? { label: "가져오기", onClick: () => takePartner(scope) }
            : null;
    return (
      <LabTile
        key={key}
        scope={scope}
        readings={readings}
        size={size}
        selected={selected}
        index={index}
        action={action}
        controllerTrendByPeriod={controllerTrendByPeriod}
        trendLoading={trendLoading}
        trendError={trendError}
        trendExtending={trendExtending}
        window15mLoading={window15mLoading}
        window15m={window15m}
        onNeedWindow15m={onNeedWindow15m}
        uplinkCoverage={uplinkCoverage}
        period={period}
        hidePeriodBrush
        brushWindow={sharedBrushWindow}
        onBrushWindowChange={setSharedBrushWindow}
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        canCommand={canCommand}
        isMobileStack={isMobileStack}
        layersToolbarActive={layersToolbarActive}
        onDismiss={size === "hero" ? () => dismissHero(scope) : undefined}
      />
    );
  };

  const heroes = scopes.filter(isHero);
  const peers = scopes.filter((s) => !isHero(s));

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1"
      data-farm-chart-lab=""
      data-tour-id="farm-chart-view"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div
          ref={modeGroupRef}
          className="relative inline-flex rounded-xl border bg-muted/40 p-1"
          role="group"
          aria-label="차트 배열"
          data-tour-id="farm-chart-lab-modes"
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg",
              dashboardChroma.viewTabPill,
              motionClass.viewTabPill,
              modePill.width <= 0 && "opacity-0",
            )}
            style={
              modePill.width > 0
                ? { left: modePill.left, width: modePill.width }
                : undefined
            }
          />
          <button
            type="button"
            aria-pressed={mode === "batch" ? "true" : "false"}
            className={modeBtn(mode === "batch")}
            onClick={openBatch}
          >
            일괄
          </button>
          <button
            type="button"
            aria-pressed={mode === "single" ? "true" : "false"}
            className={modeBtn(mode === "single")}
            disabled={!primaryKey}
            onClick={showStoredSingle}
          >
            단일
          </button>
          <button
            type="button"
            aria-pressed={mode === "compare" ? "true" : "false"}
            className={modeBtn(mode === "compare")}
            disabled={storedMode === "batch" || !primaryKey || restCount === 0}
            onClick={openCompare}
          >
            비교
          </button>
        </div>
      </div>

      {useSharedBrush ? (
        <div className="min-w-0 shrink-0">
          <UnifiedTrendPeriodBrush
            window={sharedBrushWindow}
            onWindowChange={setSharedBrushWindow}
            overviewValues={sharedBrushOverview.values}
            overviewSecondaryValues={sharedBrushOverview.secondaryValues}
            overviewMode={sharedBrushOverview.mode}
            hoverPlacement="below"
          />
        </div>
      ) : null}

      {scopes.length === 0 ? (
        <p className={cn(dashboardTypography.meta, "px-3 py-6")}>
          컨트롤러가 없습니다.
        </p>
      ) : mode === "batch" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "h-fit max-w-full",
              isMobileStack ? "w-full" : "w-fit",
              dashboardHubSurface.well,
              dashboardHubSurface.gridGap,
            )}
          >
            <div className={labBatchListClass(isMobileStack)}>
              {scopes.map((scope, index) => renderTile(scope, "cell", index))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
            {heroes.map((scope, index) => renderTile(scope, "hero", index))}
          </div>
          {peers.length ? (
            <div
              className={cn(
                "flex shrink-0 gap-2 overflow-x-auto",
                dashboardHubSurface.well,
                "px-3 py-2",
              )}
            >
              {peers.map((scope, index) =>
                renderTile(scope, "peer", index),
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LabTile({
  scope,
  readings,
  size,
  selected,
  index,
  action,
  controllerTrendByPeriod,
  trendLoading,
  trendError,
  trendExtending,
  window15mLoading,
  window15m,
  onNeedWindow15m,
  uplinkCoverage,
  period,
  hidePeriodBrush,
  brushWindow,
  onBrushWindowChange,
  alarmSettings,
  thermoSettings,
  canCommand,
  isMobileStack,
  layersToolbarActive = true,
  onDismiss,
}: {
  scope: FarmChartControllerScope;
  readings: BarnReading[];
  size: "cell" | "hero" | "peer";
  selected: boolean;
  index: number;
  action: { label: string; onClick: () => void } | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  uplinkCoverage: UplinkCoverageIndex[];
  period: TrendPeriodId;
  hidePeriodBrush?: boolean;
  brushWindow?: BrushWindow;
  onBrushWindowChange?: (window: BrushWindow) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  isMobileStack?: boolean;
  layersToolbarActive?: boolean;
  onDismiss?: () => void;
}) {
  const overview = size !== "hero";
  const scopedReadings = filterReadingsByChartScope(readings, scope);
  const controllers = scopedReadings.map((r) => ({
    key: r.controllerKey,
    reading: r,
  }));
  const label = chartScopeLabel(scope, readings);
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden",
        overview ? dashboardHubSurface.tile : "rounded-xl border bg-card",
        size === "peer"
          ? "h-[7.5rem] w-[min(16rem,100%)] shrink-0"
          : size === "cell"
            ? cn("h-[7.5rem] shrink-0", isMobileStack ? "w-full" : "w-[16rem]")
            : "h-full min-h-0 flex-1 basis-0",
        size === "hero" && farmChartUi.root,
        isMobileStack && size === "hero" && farmChartUi.yGutterCompact,
        size === "hero"
          ? motionClass.farmChartPanelShell
          : motionClass.staggerIn,
        overview && action && dashboardElevation.interactiveHover,
        selected && "border-primary",
      )}
      style={
        overview
          ? {
              animationDelay: `${Math.min(index, 12) * motionStaggerStepMs}ms`,
            }
          : undefined
      }
    >
      <UnifiedBarnTrendPanel
        label={label}
        controllers={controllers}
        controllerTrendByPeriod={controllerTrendByPeriod}
        trendLoading={trendLoading}
        trendError={trendError}
        trendExtending={trendExtending}
        window15mLoading={window15mLoading}
        window15m={window15m}
        onNeedWindow15m={onNeedWindow15m}
        uplinkCoverage={uplinkCoverage}
        period={period}
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        chartScope={scope}
        plotFill={size === "hero"}
        chartHeight={overview ? 64 : undefined}
        headingMode={overview ? "overview" : "widget"}
        hidePeriodBrush={hidePeriodBrush}
        brushWindow={brushWindow}
        onBrushWindowChange={onBrushWindowChange}
        layersToolbarActive={layersToolbarActive && size === "hero"}
        defaultOverlayView
        canCommand={canCommand}
        isMobileStack={isMobileStack}
        headerActions={
          onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                "hover:bg-muted/50 hover:text-foreground",
                motionClass.microHover,
              )}
              aria-label={`${label} 차트 끄기`}
              title="차트 끄기"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : undefined
        }
        className="mt-0 h-full min-h-0 flex-1"
      />
      {action ? (
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={action.label}
          title={action.label}
          onClick={action.onClick}
        />
      ) : null}
    </div>
  );
}
