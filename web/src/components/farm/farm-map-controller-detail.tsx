"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import { SEV_COLOR } from "@/lib/farm/severity-score";
import { METRIC_ID_COLORS } from "@/lib/farm/trend-chart-series";
import {
  currentStackMetricValue,
  formatStackMetricValue,
  worstSingleStackMetric,
  type StackMetric,
} from "@/lib/farm/stack-metric";
import { ControllerSummaryGaugeRow } from "./controller-summary-gauge-row";
import { BarnListGraphPanel } from "./barn-list-graph-panel";
import { MetricLineChart } from "./severity-heatmap";
import { PanelCloseButton } from "./panel-close-button";
import { GridMetricLabel, gridMetricAriaLabel } from "@/lib/farm/grid-metric-label";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { controllerKeyForReadingKey } from "@/lib/farm/use-barn-graphs";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";

/** 지표(행) 탭 — 히트맵 행과 동일한 순서/라벨. */
const METRIC_TABS: { id: string; label: string }[] = [
  { id: "T", label: "온도" },
  { id: "H", label: "습도" },
  { id: "A", label: "A" },
  { id: "B", label: "B" },
  { id: "C", label: "C" },
];

function isFeatureTourActive(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(document.querySelector('[aria-label="기능 안내 투어"]'))
  );
}

export type FarmMapControllerDetailController = {
  key: string;
  eqpmnNo: string;
  label: string;
  reading: BarnReading | null;
  metricsById: Record<string, StackMetric>;
};

export type FarmMapControllerDetailData = {
  barnId: string;
  label: string;
  controllers: FarmMapControllerDetailController[];
};

type Props = {
  label: string;
  metricId: string;
  controllers: FarmMapControllerDetailController[];
  gridCols?: number;
  period: TrendPeriodId;
  bars: number;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  onPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  onChangeMetric: (metricId: string) => void;
  onClose: () => void;
  /** picker·외부 동기화 — BarnReading.key */
  selectedReadingKey?: string | null;
  onSelectedReadingKeyChange?: (readingKey: string | null) => void;
  /** picker에서 다른 축사 컨트롤러 선택 */
  onPickerNavigateReading?: (readingKey: string) => void;
  /**
   * 부모가 bottom sheet를 호스트할 때.
   * Detail이 축사유형 전환으로 remount되어도 sheet는 유지된다.
   */
  hostedMobileSheetOpen?: boolean;
  hostedMobileSheetPage?: ControllerMobileSheetPage;
  onHostedMobileSheetOpenChange?: (open: boolean) => void;
  onHostedMobileSheetPageChange?: (page: ControllerMobileSheetPage) => void;
};

export function FarmMapControllerDetail({
  label,
  metricId,
  controllers,
  gridCols,
  period,
  readings,
  thermoSettings,
  commands,
  canCommand,
  alarmSettings,
  controllerTrendByPeriod,
  onPeriodChange,
  trendLoading = false,
  trendStale = false,
  onChangeMetric,
  onClose,
  selectedReadingKey = null,
  onSelectedReadingKeyChange,
  onPickerNavigateReading,
  hostedMobileSheetOpen = false,
  hostedMobileSheetPage = 0,
  onHostedMobileSheetOpenChange,
  onHostedMobileSheetPageChange,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelPeriod, setPanelPeriod] = useState<TrendPeriodId>(period);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerCardRef = useRef<HTMLDivElement | null>(null);

  const panelLayoutVariant = viewportCompact
    ? ("stack" as const)
    : typeof gridCols === "number" && gridCols >= 2
      ? ("grid" as const)
      : ("stack" as const);
  const isMobileStack = panelLayoutVariant === "stack";
  const sheetHosted = typeof onHostedMobileSheetOpenChange === "function";

  const mobileGraphOpen = sheetHosted
    ? hostedMobileSheetOpen && hostedMobileSheetPage === 0
    : graphOpen;
  const mobileSettingsOpen = sheetHosted
    ? hostedMobileSheetOpen && hostedMobileSheetPage === 1
    : settingsOpen;

  const availableMetricIds = useMemo(() => {
    const has = (id: string) =>
      controllers.some((c) => {
        const m = c.metricsById[id];
        return (
          Boolean(m) && m.values.some((v) => v != null && Number.isFinite(v))
        );
      });
    return METRIC_TABS.filter((t) => has(t.id)).map((t) => t.id);
  }, [controllers]);
  const effectiveMetricId = availableMetricIds.includes(metricId)
    ? metricId
    : (availableMetricIds[0] ?? metricId);

  useEffect(() => {
    setPanelPeriod(period);
  }, [period]);

  useEffect(() => {
    if (isFeatureTourActive()) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [label]);

  useEffect(() => {
    if (!mobileSettingsOpen || !isMobileStack) return;
    if (isFeatureTourActive()) return;
    controllerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mobileSettingsOpen, isMobileStack]);

  const syncSelectedReadingKey = (readingKey: string | null) => {
    onSelectedReadingKeyChange?.(readingKey);
  };

  const resolveControllerKey = useCallback(
    (readingKey: string): string | null => {
      const fromReading = controllerKeyForReadingKey(readings, readingKey);
      if (fromReading && controllers.some((c) => c.key === fromReading)) {
        return fromReading;
      }
      return controllers.some((c) => c.key === readingKey) ? readingKey : null;
    },
    [controllers, readings],
  );

  const selected = useMemo(() => {
    const fromState =
      selectedKey && controllers.some((c) => c.key === selectedKey)
        ? selectedKey
        : null;
    const fromReading = selectedReadingKey
      ? resolveControllerKey(selectedReadingKey)
      : null;
    const key = fromState ?? fromReading;
    return key ? (controllers.find((c) => c.key === key) ?? null) : null;
  }, [
    controllers,
    selectedKey,
    selectedReadingKey,
    resolveControllerKey,
  ]);

  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = sheetHosted
    ? hostedMobileSheetOpen
    : graphOpen || settingsOpen;

  const openMobileSheet = useCallback(
    (page: ControllerMobileSheetPage) => {
      const readingKey =
        selected?.reading?.key ??
        selectedReadingKey ??
        null;
      if (readingKey) syncSelectedReadingKey(readingKey);
      if (sheetHosted) {
        onHostedMobileSheetOpenChange?.(true);
        onHostedMobileSheetPageChange?.(page);
        return;
      }
      if (page === 1) {
        setGraphOpen(false);
        setSettingsOpen(true);
      } else {
        setSettingsOpen(false);
        setGraphOpen(true);
      }
    },
    [
      selected?.reading?.key,
      selectedReadingKey,
      sheetHosted,
      onHostedMobileSheetOpenChange,
      onHostedMobileSheetPageChange,
    ],
  );

  const closeMobileSheet = useCallback(() => {
    if (sheetHosted) {
      onHostedMobileSheetOpenChange?.(false);
      return;
    }
    setGraphOpen(false);
    setSettingsOpen(false);
  }, [sheetHosted, onHostedMobileSheetOpenChange]);

  useEffect(() => {
    if (!selectedReadingKey) return;
    const ctrlKey = resolveControllerKey(selectedReadingKey);
    if (!ctrlKey) return;
    setSelectedKey(ctrlKey);
    // sheet가 이미 열려 있으면 페이지(모터/설정) 유지 — 닫혀 있을 때만 기본 오픈
    if (isMobileStack && !sheetOpenRef.current) {
      openMobileSheet(0);
    }
  }, [
    selectedReadingKey,
    resolveControllerKey,
    isMobileStack,
    openMobileSheet,
  ]);

  const selectControllerFromPicker = (readingKey: string) => {
    const ctrlKey = resolveControllerKey(readingKey);
    if (ctrlKey) {
      setSelectedKey(ctrlKey);
      syncSelectedReadingKey(readingKey);
      // picker 전환 — sheet 유지, 표시 컨트롤러만 변경
      return;
    }
    syncSelectedReadingKey(readingKey);
    onPickerNavigateReading?.(readingKey);
  };

  const selectController = (key: string) => {
    if (selectedKey === key) {
      setSelectedKey(null);
      closeMobileSheet();
      syncSelectedReadingKey(null);
      return;
    }
    setSelectedKey(key);
    const reading = controllers.find((c) => c.key === key)?.reading;
    syncSelectedReadingKey(reading?.key ?? null);
    if (isMobileStack) {
      if (!sheetOpenRef.current) openMobileSheet(0);
    } else {
      setGraphOpen(false);
      setSettingsOpen(false);
    }
  };

  const handleSheetPageChange = (page: ControllerMobileSheetPage) => {
    if (sheetHosted) {
      onHostedMobileSheetOpenChange?.(true);
      onHostedMobileSheetPageChange?.(page);
      return;
    }
    if (page === 0) {
      setSettingsOpen((settingsOpen) => {
        if (!settingsOpen) return settingsOpen;
        return false;
      });
      setGraphOpen((graphOpen) => (graphOpen ? graphOpen : true));
      return;
    }
    setGraphOpen((graphOpen) => {
      if (!graphOpen) return graphOpen;
      return false;
    });
    setSettingsOpen((settingsOpen) => (settingsOpen ? settingsOpen : true));
  };

  const count = controllers.length;
  const useColGrid = typeof gridCols === "number" && gridCols >= 1;
  const gridColsClass =
    count <= 2
      ? "sm:grid-cols-2"
      : count <= 6
        ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  const chartHeight = count <= 2 ? 84 : count <= 6 ? 64 : 48;
  const dense = count > 6;

  return (
    <div
      ref={rootRef}
      className={cn(
        "farm-heat-morph border-t bg-muted/20 px-3 py-3",
        isMobileStack &&
          "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
      )}
      data-tour-id="detail-panel"
    >
      <div
        className="mb-2.5 flex flex-wrap items-center gap-2"
        data-tour-id="detail-panel-header"
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          · 컨트롤러별 · {trendPeriodLabel(period)} · {controllers.length}대
        </span>
        <div
          className="ml-1 inline-flex overflow-hidden rounded-md border bg-background text-[0.7rem]"
          role="group"
          aria-label="지표"
        >
          {METRIC_TABS.filter((t) => availableMetricIds.includes(t.id)).map(
            (t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeMetric(t.id)}
                aria-label={gridMetricAriaLabel(t.id, t.label)}
                className={cn(
                  "flex min-w-[2rem] items-center justify-center px-2 py-1 font-medium transition-colors",
                  effectiveMetricId === t.id
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <GridMetricLabel
                  id={t.id}
                  label={t.label}
                  mode="icon"
                  iconClassName="size-3.5"
                />
              </button>
            ),
          )}
        </div>
        <PanelCloseButton className="ml-auto" onClick={onClose} />
      </div>

      {controllers.length === 0 ? (
        <div className="rounded-md border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
          컨트롤러 시계열을 불러오는 중이거나 데이터가 없습니다.
        </div>
      ) : (
        <>
          {!selected ? (
          <div
            className={cn(
              "grid",
              !useColGrid && cn("grid-cols-1 gap-2", gridColsClass),
            )}
            data-tour-id="detail-panel-charts"
            style={
              useColGrid
                ? {
                    gridTemplateColumns: `repeat(${gridCols}, minmax(4.75rem, 1fr))`,
                    gap: "0.375rem",
                  }
                : undefined
            }
          >
            {controllers.map((c, chartIndex) => {
              const metric = c.metricsById[effectiveMetricId];
              const cur = metric ? currentStackMetricValue(metric.values) : null;
              const worst = metric ? worstSingleStackMetric(metric) : "normal";
              const isSel = c.key === selectedKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  data-tour-id={
                    chartIndex === 0 ? "detail-panel-chart-first" : undefined
                  }
                  onClick={() => selectController(c.key)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex flex-col rounded-md border bg-background p-2 text-left transition-colors hover:border-sky-400",
                    isSel && "border-sky-500 ring-2 ring-sky-500/30",
                    !isSel && worst === "warning" && "border-red-500/50",
                    !isSel && worst === "caution" && "border-amber-500/50",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 shrink-0 rounded-sm"
                      style={{ background: SEV_COLOR[worst] }}
                      aria-hidden
                    />
                    <span className="truncate text-[0.7rem] font-semibold">
                      {c.label}
                    </span>
                    {!dense ? (
                      <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                        EQP{c.eqpmnNo}
                      </span>
                    ) : null}
                    <span
                      className="ml-auto shrink-0 text-[0.7rem] font-semibold"
                      style={{ color: SEV_COLOR[worst] }}
                    >
                      {formatStackMetricValue(cur, metric?.unit)}
                    </span>
                  </div>
                  {metric ? (
                    <MetricLineChart
                      values={metric.values}
                      band={metric.band}
                      height={chartHeight}
                      color={METRIC_ID_COLORS[effectiveMetricId] ?? "#0ea5e9"}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-[0.65rem] text-muted-foreground"
                      style={{ height: chartHeight }}
                    >
                      데이터 없음
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          ) : null}

          {selected ? (
            selected.reading ? (
              <div ref={controllerCardRef} className="farm-heat-morph mt-3 space-y-3">
                <ControllerSummaryGaugeRow
                  reading={selected.reading}
                  readings={readings}
                  thermoSettings={thermoSettings}
                  commands={commands}
                  canCommand={canCommand}
                  alarmSettings={alarmSettings}
                  controllerTrendByPeriod={controllerTrendByPeriod}
                  bulkPeriod={period}
                  panelPeriodOverrides={{ [selected.reading.key]: panelPeriod }}
                  onPanelPeriodChange={(_, p) => setPanelPeriod(p)}
                  hideGraphToggle={!isMobileStack}
                  panelPlacement="right"
                  gridCols={gridCols}
                  panelLayoutVariant={panelLayoutVariant}
                  graphExpanded={isMobileStack ? mobileGraphOpen : false}
                  settingsExpanded={
                    isMobileStack ? mobileSettingsOpen : settingsOpen
                  }
                  onToggleGraph={() => {
                    if (sheetHosted && isMobileStack) {
                      if (hostedMobileSheetOpen && hostedMobileSheetPage === 0) {
                        onHostedMobileSheetOpenChange?.(false);
                      } else {
                        openMobileSheet(0);
                      }
                      return;
                    }
                    setSettingsOpen(false);
                    setGraphOpen((v) => !v);
                  }}
                  onToggleSettings={() => {
                    if (sheetHosted && isMobileStack) {
                      if (hostedMobileSheetOpen && hostedMobileSheetPage === 1) {
                        onHostedMobileSheetOpenChange?.(false);
                      } else {
                        openMobileSheet(1);
                      }
                      return;
                    }
                    setGraphOpen(false);
                    setSettingsOpen((v) => !v);
                  }}
                  onSheetPageChange={
                    isMobileStack ? handleSheetPageChange : undefined
                  }
                  sheetPickerReadings={
                    isMobileStack ? readings : undefined
                  }
                  onSheetPickerSelect={
                    isMobileStack ? selectControllerFromPicker : undefined
                  }
                  showSheetPickerAffiliation={isMobileStack}
                  suppressPerCardMobileSheet={sheetHosted && isMobileStack}
                />
                {!isMobileStack ? (
                  <BarnListGraphPanel
                    reading={selected.reading}
                    controllerTrendByPeriod={controllerTrendByPeriod ?? null}
                    period={period}
                    onPeriodChange={onPeriodChange ?? (() => {})}
                    alarmSettings={alarmSettings}
                    thermoSettings={thermoSettings}
                    loading={trendLoading}
                    stale={trendStale}
                    showChannelSection={!settingsOpen}
                  />
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                이 컨트롤러의 실시간 판독값을 찾을 수 없습니다.
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
