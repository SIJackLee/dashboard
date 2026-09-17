"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import {
  BRUSH_PERIOD_WINDOW,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import {
  UnifiedTrendLayerToolbar,
  UNIFIED_LAYER_TOOLBAR_AVAILABLE,
  applyLayerGroupMode,
  detectLayerGroupMode,
  nextLayerGroupMode,
  type LayerGroupId,
  type SharedChartLayerDisplay,
} from "@/components/farm/unified-trend-layer-toolbar";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
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
import {
  countSplitYBands,
  DEFAULT_UNIFIED_LAYERS,
  splitYVisibilityFromLayers,
} from "@/lib/farm/unified-barn-trend-series";
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
    () => BRUSH_PERIOD_WINDOW["30d"],
  );
  const resetLookbackTo30d = useCallback(() => {
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW["30d"]);
  }, []);
  const ignoreLookbackChange = useCallback((_next: BrushWindow) => {
    /* 일괄은 30일 고정 */
  }, []);
  const [layers, setLayers] = useState(DEFAULT_UNIFIED_LAYERS);
  const [overlayView, setOverlayView] = useState(true);
  const [alarmRangeOn, setAlarmRangeOn] = useState({ temp: true, hum: true });
  const layerVisibility = useMemo(
    () => splitYVisibilityFromLayers(layers),
    [layers],
  );
  const overlayAvailable = countSplitYBands(layerVisibility) >= 2;
  const sharedLayers: SharedChartLayerDisplay = useMemo(
    () => ({ layers, overlayView, alarmRangeOn }),
    [layers, overlayView, alarmRangeOn],
  );
  const cycleGroupLayers = useCallback((group: LayerGroupId) => {
    setLayers((prev) => {
      const mode = detectLayerGroupMode(
        prev,
        UNIFIED_LAYER_TOOLBAR_AVAILABLE,
        group,
      );
      return applyLayerGroupMode(
        prev,
        group,
        nextLayerGroupMode(mode),
        UNIFIED_LAYER_TOOLBAR_AVAILABLE,
      );
    });
  }, []);

  const labRootRef = useRef<HTMLDivElement>(null);
  const modeGroupRef = useRef<HTMLDivElement>(null);
  const [modePill, setModePill] = useState({ left: 0, width: 0 });
  const [expandOrigin, setExpandOrigin] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const settleExpand = useCallback(() => setExpandOrigin(null), []);
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
    setExpandOrigin(null);
    resetLookbackTo30d();
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
  const expandFromTile = (
    scope: FarmChartControllerScope,
    tileEl: HTMLElement | null,
  ) => {
    if (tileEl) {
      const r = tileEl.getBoundingClientRect();
      setExpandOrigin({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    } else {
      setExpandOrigin(null);
    }
    openSingle(scope);
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
    if (next.mode === "batch") resetLookbackTo30d();
    if (urlBound) {
      commitSelection(farmChartLabSelectionFromKeys(scopes, next));
      return;
    }
    setLocalPrimaryKey(next.primaryKey);
    setLocalPartnerKey(next.partnerKey);
    setLocalMode(next.mode);
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
        ? {
            label: "이 칸 펼치기",
            onClick: (e: MouseEvent<HTMLButtonElement>) => {
              const tile = e.currentTarget.closest<HTMLElement>(
                "[data-farm-chart-tile]",
              );
              expandFromTile(scope, tile);
            },
          }
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
        brushWindow={
          mode === "batch"
            ? BRUSH_PERIOD_WINDOW["30d"]
            : sharedBrushWindow
        }
        onBrushWindowChange={
          mode === "batch" ? ignoreLookbackChange : setSharedBrushWindow
        }
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        canCommand={canCommand}
        isMobileStack={isMobileStack}
        sharedLayers={sharedLayers}
        layerChrome={
          size === "hero" && index === 0 && layersToolbarActive
            ? layerToolbar
            : null
        }
        expandFrom={size === "hero" && index === 0 ? expandOrigin : null}
        onExpandSettled={settleExpand}
        onDismiss={size === "hero" ? () => dismissHero(scope) : undefined}
      />
    );
  };

  const heroes = scopes.filter(isHero);
  const peers = scopes.filter((s) => !isHero(s));
  const showPeers = mode === "compare" && peers.length > 0;
  const layerToolbar = layersToolbarActive ? (
    <div
      className="relative inline-flex rounded-xl border bg-muted/40 p-1"
      data-farm-chart-layers-shell=""
    >
      <UnifiedTrendLayerToolbar
        layers={layers}
        available={UNIFIED_LAYER_TOOLBAR_AVAILABLE}
        onCycleGroup={cycleGroupLayers}
        overlayView={overlayView}
        overlayAvailable={overlayAvailable}
        onToggleOverlay={() => setOverlayView((v) => !v)}
        tempAlarmOn={alarmRangeOn.temp}
        humAlarmOn={alarmRangeOn.hum}
        tempAlarmAvailable={Boolean(
          layerVisibility.showTemp && layers.temp,
        )}
        humAlarmAvailable={Boolean(
          layerVisibility.showHum &&
            (layers.hum ||
              layers.humDev ||
              layers.humBand ||
              layers.humEma),
        )}
        onToggleTempAlarm={() =>
          setAlarmRangeOn((prev) => ({ ...prev, temp: !prev.temp }))
        }
        onToggleHumAlarm={() =>
          setAlarmRangeOn((prev) => ({ ...prev, hum: !prev.hum }))
        }
        compact
      />
    </div>
  ) : null;

  return (
    <div
      ref={labRootRef}
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
            aria-pressed={mode !== "compare" ? "true" : "false"}
            className={modeBtn(mode !== "compare")}
            onClick={openBatch}
          >
            일괄
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
          {showPeers ? (
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
  sharedLayers,
  layerChrome = null,
  expandFrom = null,
  onExpandSettled,
  onDismiss,
}: {
  scope: FarmChartControllerScope;
  readings: BarnReading[];
  size: "cell" | "hero" | "peer";
  selected: boolean;
  index: number;
  action: {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  } | null;
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
  sharedLayers: SharedChartLayerDisplay;
  layerChrome?: ReactNode;
  expandFrom?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  onExpandSettled?: () => void;
  onDismiss?: () => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const overview = size !== "hero";
  const scopedReadings = filterReadingsByChartScope(readings, scope);
  const controllers = scopedReadings.map((r) => ({
    key: r.controllerKey,
    reading: r,
  }));
  const label = chartScopeLabel(scope, readings);

  useLayoutEffect(() => {
    const el = tileRef.current;
    if (size !== "hero" || !expandFrom || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onExpandSettled?.();
      return;
    }
    const dest = el.getBoundingClientRect();
    if (!(dest.width > 1) || !(dest.height > 1)) {
      onExpandSettled?.();
      return;
    }
    const dx = expandFrom.left - dest.left;
    const dy = expandFrom.top - dest.top;
    const sx = expandFrom.width / dest.width;
    const sy = expandFrom.height / dest.height;
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    const play = () => {
      el.style.transition =
        "transform var(--motion-duration-emphasis) var(--motion-ease-enter)";
      el.style.transform = "translate(0, 0) scale(1, 1)";
    };
    const frame = window.requestAnimationFrame(play);
    const done = (ev: TransitionEvent) => {
      if (ev.propertyName !== "transform") return;
      el.style.transition = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
      onExpandSettled?.();
    };
    el.addEventListener("transitionend", done);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("transitionend", done);
    };
  }, [size, expandFrom, onExpandSettled]);

  return (
    <div
      ref={tileRef}
      data-farm-chart-tile=""
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
        size === "hero" && !expandFrom
          ? motionClass.farmChartPanelShell
          : size !== "hero"
            ? motionClass.staggerIn
            : null,
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
      {layerChrome ? (
        <div className="flex shrink-0 items-center px-2 pt-2">{layerChrome}</div>
      ) : null}
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
        sharedLayers={sharedLayers}
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
