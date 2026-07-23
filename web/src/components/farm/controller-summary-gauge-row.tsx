"use client";

import { useCallback, useState } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import {
  DEFAULT_TREND_PERIOD,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import {
  BarnControllerMobileSheet,
  controllerMobileSheetPageFromFlags,
} from "@/components/farm/barn-controller-mobile-sheet";
import { ControllerMobilePage } from "@/components/farm/controller-mobile-page";
import { ControllerMobileSettingsPage } from "@/components/farm/controller-mobile-settings-page";
import { BarnMotorTrendPanel } from "@/components/farm/barn-motor-trend-panel";
import { BarnListGraphPanel } from "@/components/farm/barn-list-graph-panel";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import {
  ChannelStrip,
  ControllerSummaryHeader,
  statusRingClass,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";
import { cn } from "@/lib/utils";

/** 그리드 상세 — PC 2단(grid) vs 모바일 stack(+ carousel sheet). */
export type ControllerPanelLayoutVariant = "grid" | "stack";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  listMode?: BarnListViewMode;
  graphExpanded?: boolean;
  settingsExpanded?: boolean;
  /** 모바일 — panelSets 기반 sheet만 열림 (미전달 시 graph/settingsExpanded로 판단) */
  mobileSheetOpen?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  /** 모바일 sheet carousel — 스와이프·segment 시 pill 상태 동기화 */
  onSheetPageChange?: (page: ControllerMobileSheetPage) => void;
  /** 그리드 stack — 그래프 pill 숨김(차트 tap으로 sheet 진입). 목록 stack에서는 false. */
  hideGraphToggle?: boolean;
  panelPlacement?: "bottom" | "right";
  gridCols?: number;
  panelLayoutVariant?: ControllerPanelLayoutVariant;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  showAffiliation?: boolean;
  className?: string;
  /** 모바일 목록 Graph/Set toolbar — 인라인 패널 숨김 */
  suppressMobileInlinePanels?: boolean;
  /** 모바일 목록 Graph/Set toolbar — per-card sheet 숨김 */
  suppressPerCardMobileSheet?: boolean;
  /** toolbar sheet에서 선택된 카드 */
  toolbarSheetSelected?: boolean;
  /** toolbar sheet — 카드 탭 시 컨트롤러 선택 */
  onCardActivate?: () => void;
  /** bottom sheet 상단 swipe picker (그리드·목록 Graph/Set) */
  sheetPickerReadings?: BarnReading[];
  onSheetPickerSelect?: (key: string) => void;
  showSheetPickerAffiliation?: boolean;
};

/** PC·Mobile 공통 — 게이지·채널 고정 + 카드별 pill로 패널 드롭다운 / 모바일 sheet */
export function ControllerSummaryGaugeRow({
  reading,
  readings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  listMode = "controller",
  graphExpanded = false,
  settingsExpanded = false,
  mobileSheetOpen: mobileSheetOpenProp,
  onToggleGraph,
  onToggleSettings,
  onSheetPageChange,
  hideGraphToggle = false,
  panelPlacement = "bottom",
  gridCols,
  panelLayoutVariant,
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
  bulkPeriod = DEFAULT_TREND_PERIOD,
  panelPeriodOverrides = {},
  onPanelPeriodChange,
  showAffiliation = false,
  className,
  suppressMobileInlinePanels = false,
  suppressPerCardMobileSheet = false,
  toolbarSheetSelected = false,
  onCardActivate,
  sheetPickerReadings,
  onSheetPickerSelect,
  showSheetPickerAffiliation = false,
}: Props) {
  const [expandedChannel, setExpandedChannel] = useState<ChannelSlot | null>(null);
  const [expandedForKey, setExpandedForKey] = useState(reading.key);
  if (reading.key !== expandedForKey) {
    setExpandedForKey(reading.key);
    setExpandedChannel(null);
  }

  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  const panelPeriod = panelPeriodOverrides[reading.key] ?? bulkPeriod;

  const resolvedPanelLayout: ControllerPanelLayoutVariant =
    panelLayoutVariant ??
    (typeof gridCols === "number" && gridCols >= 2 ? "grid" : "stack");

  const useMobileSheet = resolvedPanelLayout === "stack";
  const mobileSheetOpen =
    useMobileSheet &&
    (mobileSheetOpenProp !== undefined
      ? mobileSheetOpenProp
      : graphExpanded || settingsExpanded);

  const showInlineGraphOnMobile =
    useMobileSheet &&
    graphExpanded &&
    !mobileSheetOpen &&
    !suppressMobileInlinePanels;
  const showInlineSettingsOnMobile =
    useMobileSheet &&
    settingsExpanded &&
    !mobileSheetOpen &&
    !suppressMobileInlinePanels;

  const motorTrendVisible =
    panelPlacement === "right" && settingsExpanded;

  const motorTrendCompact =
    panelPlacement === "right" && resolvedPanelLayout === "stack";

  const toggleChannel = useCallback((slot: ChannelSlot) => {
    setExpandedChannel((prev) => (prev === slot ? null : slot));
  }, []);

  const setpoint = thermo?.setpointTemp;
  const setDev = thermo?.tempDeviation;

  const cardClass = cn(
    "flex h-full min-w-0 flex-col rounded-xl border bg-card",
    expandedChannel ? "overflow-visible" : "overflow-hidden",
    !toolbarSheetSelected && statusRingClass(reading.status),
    toolbarSheetSelected && "ring-2 ring-emerald-500/70",
    !toolbarSheetSelected && graphExpanded && "ring-2 ring-sky-500/40",
    !toolbarSheetSelected && settingsExpanded && "ring-2 ring-violet-500/40",
    onCardActivate && "cursor-pointer",
    className,
  );

  const metricsBlock = (
    <>
      <div data-tour-id="controller-gauge-metrics">
        <EnvMetricPanel
          className="mb-2"
          offline={offline}
          setpoint={setpoint}
          setDev={setDev}
          temp={{
            value: reading.tempC,
            displayValue: temp ?? "—",
            low: thresholds.tempLow,
            high: thresholds.tempHigh,
            breached: tempAlarmBreached,
          }}
          humidity={{
            value: reading.humidityPct,
            displayValue: humidity ?? "—",
            low: thresholds.humidityLow,
            high: thresholds.humidityHigh,
            breached: humidityAlarmBreached,
          }}
        />
      </div>
      <ChannelStrip
        reading={reading}
        thermo={thermo}
        compact
        expandedChannel={expandedChannel}
        onToggleChannel={toggleChannel}
        controllerTrendByPeriod={controllerTrendByPeriod}
        period={panelPeriod}
        thermoSettings={thermoSettings}
      />
    </>
  );

  const sheetMetricsBlock = (
    <>
      <div data-tour-id="controller-gauge-metrics">
        <EnvMetricPanel
          className="mb-2"
          offline={offline}
          setpoint={setpoint}
          setDev={setDev}
          temp={{
            value: reading.tempC,
            displayValue: temp ?? "—",
            low: thresholds.tempLow,
            high: thresholds.tempHigh,
            breached: tempAlarmBreached,
          }}
          humidity={{
            value: reading.humidityPct,
            displayValue: humidity ?? "—",
            low: thresholds.humidityLow,
            high: thresholds.humidityHigh,
            breached: humidityAlarmBreached,
          }}
        />
      </div>
      <ChannelStrip reading={reading} thermo={thermo} compact hideMotorExpand />
    </>
  );

  const cardBody = (
    <>
      <div className="px-2.5 pt-2.5 sm:px-3 sm:pt-3">
        <ControllerSummaryHeader
          reading={reading}
          graphActive={graphExpanded}
          settingsActive={settingsExpanded}
          showGraphPill={!hideGraphToggle}
          showAffiliation={showAffiliation}
          onToggleGraph={onToggleGraph}
          onToggleSettings={onToggleSettings}
          className="mb-2 w-full"
        />
      </div>
      <div className="shrink-0 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        {metricsBlock}
      </div>
    </>
  );

  const handleSheetClose = useCallback(() => {
    if (settingsExpanded) onToggleSettings?.();
    else if (graphExpanded) onToggleGraph?.();
  }, [graphExpanded, settingsExpanded, onToggleGraph, onToggleSettings]);

  const handleSheetPageSettled = useCallback(
    (page: ControllerMobileSheetPage) => {
      onSheetPageChange?.(page);
    },
    [onSheetPageChange],
  );

  const mobileSheet = useMobileSheet && !suppressPerCardMobileSheet ? (
    <BarnControllerMobileSheet
      open={mobileSheetOpen}
      initialPage={controllerMobileSheetPageFromFlags(settingsExpanded)}
      onClose={handleSheetClose}
      onPageSettled={handleSheetPageSettled}
      reading={reading}
      pickerReadings={sheetPickerReadings}
      selectedReadingKey={reading.key}
      onSelectReading={onSheetPickerSelect}
      showPickerAffiliation={showSheetPickerAffiliation}
      controllerPage={
        <ControllerMobilePage
          key={reading.key}
          metricsSection={sheetMetricsBlock}
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          thermoSettings={thermoSettings}
        />
      }
      settingsPage={
        <ControllerMobileSettingsPage
          key={reading.key}
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          onPeriodChange={(p) => onPanelPeriodChange?.(reading.key, p)}
          trendLoading={trendLoading}
          trendStale={trendStale}
        />
      }
    />
  ) : null;

  const graphPanel = hideGraphToggle ? null : (
    <BarnListPanelShell open={graphExpanded} panelKind="graph">
      {graphExpanded ? (
        <BarnListGraphPanel
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod ?? null}
          period={panelPeriod}
          onPeriodChange={(p) => onPanelPeriodChange?.(reading.key, p)}
          alarmSettings={alarmSettings}
          thermoSettings={thermoSettings}
          loading={trendLoading}
          stale={trendStale}
        />
      ) : null}
    </BarnListPanelShell>
  );

  const settingsPanel = (
    <BarnListPanelShell open={settingsExpanded} panelKind="settings">
      {settingsExpanded ? (
        <BarnListAccordionPanel
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          collapsibleSections
        />
      ) : null}
    </BarnListPanelShell>
  );

  const motorTrendPanel = motorTrendVisible ? (
    <div
      className="barn-list-panel-stagger--motor border-t bg-muted/15 px-2.5 pb-2.5 pt-2 sm:px-3"
      data-audit-region="controller-motor-trend"
    >
      <BarnMotorTrendPanel
        reading={reading}
        controllerTrendByPeriod={controllerTrendByPeriod}
        period={panelPeriod}
        thermoSettings={thermoSettings}
        layout="split"
        compact={panelPlacement === "right"}
        dense={motorTrendCompact}
      />
    </div>
  ) : null;

  if (panelPlacement === "right") {
    const motorTrendBottom = motorTrendVisible ? motorTrendPanel : null;

    if (resolvedPanelLayout === "grid" && typeof gridCols === "number" && gridCols >= 2) {
      const cardSpan = Math.min(2, gridCols);
      const panelSpan = Math.max(1, gridCols - cardSpan);
      return (
        <div
          className="grid min-w-0 items-stretch"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(4.75rem, 1fr))`,
            gap: "0.375rem",
          }}
        >
          <div
            className={cardClass}
            style={{ gridColumn: `span ${cardSpan}` }}
            data-tour-id="controller-card"
            data-controller-card-key={reading.key}
            data-controller-key={reading.controllerKey}
            data-list-mode={listMode}
            data-panel-layout="grid"
          >
            {cardBody}
            {motorTrendBottom ? (
              <div className="mt-auto flex min-h-0 flex-1 flex-col">{motorTrendBottom}</div>
            ) : null}
          </div>
          {settingsExpanded ? (
            <div
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
              style={{ gridColumn: `span ${panelSpan}` }}
            >
              {settingsPanel}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div
          className={cn(cardClass, "w-full")}
          data-tour-id="controller-card"
          data-controller-card-key={reading.key}
          data-controller-key={reading.controllerKey}
          data-list-mode={listMode}
          data-panel-layout="stack"
        >
          {cardBody}
          {motorTrendBottom}
        </div>
        {mobileSheet}
      </>
    );
  }

  if (useMobileSheet) {
    return (
      <>
        <div
          className={cardClass}
          data-tour-id="controller-card"
          data-controller-card-key={reading.key}
          data-controller-key={reading.controllerKey}
          data-list-mode={listMode}
          data-panel-layout="stack"
          onClick={onCardActivate}
          onKeyDown={
            onCardActivate
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardActivate();
                  }
                }
              : undefined
          }
          role={onCardActivate ? "button" : undefined}
          tabIndex={onCardActivate ? 0 : undefined}
        >
          {cardBody}
          {showInlineGraphOnMobile ? graphPanel : null}
          {showInlineSettingsOnMobile ? settingsPanel : null}
        </div>
        {mobileSheet}
      </>
    );
  }

  return (
    <div
      className={cardClass}
      data-tour-id="controller-card"
      data-controller-card-key={reading.key}
      data-controller-key={reading.controllerKey}
      data-list-mode={listMode}
    >
      {cardBody}
      {graphPanel}
      {settingsPanel}
    </div>
  );
}
