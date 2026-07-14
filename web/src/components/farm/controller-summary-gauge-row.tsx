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
import { CHANNELS } from "@/lib/farm/controller-summary-display";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import { BarnListGraphPanel } from "@/components/farm/barn-list-graph-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { ChannelFanDropdown } from "@/components/farm/channel-fan-dropdown";
import {
  ChannelStrip,
  ControllerSummaryHeader,
  statusRingClass,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";
import { cn } from "@/lib/utils";

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
  motorExpanded?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  onToggleMotor?: () => void;
  /** 그리드 전용 — 그래프 Pill/패널 숨김(상단 오버레이 그래프가 대체). */
  hideGraphToggle?: boolean;
  /** 설정/모터 패널 위치 — "right"면 카드 우측(그리드 전용), 기본은 카드 하단. */
  panelPlacement?: "bottom" | "right";
  /** 그리드 보드 컬럼 수 — right 배치에서 카드/패널 폭을 축사유형 카드(1 컬럼) 단위로 정렬. */
  gridCols?: number;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  className?: string;
};

/** PC·Mobile 공통 — 게이지·채널 고정 + 카드별 pill로 패널 드롭다운 */
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
  motorExpanded = false,
  onToggleGraph,
  onToggleSettings,
  onToggleMotor,
  hideGraphToggle = false,
  panelPlacement = "bottom",
  gridCols,
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
  bulkPeriod = DEFAULT_TREND_PERIOD,
  panelPeriodOverrides = {},
  onPanelPeriodChange,
  className,
}: Props) {
  const [expandedChannel, setExpandedChannel] = useState<ChannelSlot | null>(null);
  const isChannelBatchMode = listMode === "channel" && motorExpanded;

  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  const needsChannelDetail =
    (motorExpanded || expandedChannel != null) && !offline;

  const { reading: channelDetail, showLoading: channelDetailShowLoading } =
    useControllerDetail(needsChannelDetail ? reading : undefined);

  const toggleChannel = useCallback((slot: ChannelSlot) => {
    setExpandedChannel((prev) => (prev === slot ? null : slot));
  }, []);

  const setpoint = thermo?.setpointTemp;
  const setDev = thermo?.tempDeviation;

  const cardClass = cn(
    "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card",
    statusRingClass(reading.status),
    graphExpanded && "ring-2 ring-sky-500/40",
    settingsExpanded && "ring-2 ring-violet-500/40",
    motorExpanded && "ring-2 ring-sky-500/25",
    className,
  );

  const cardBody = (
    <>
      <div className="px-2.5 pt-2.5 sm:px-3 sm:pt-3">
        <ControllerSummaryHeader
          reading={reading}
          graphActive={graphExpanded}
          settingsActive={settingsExpanded}
          motorActive={motorExpanded}
          showGraphPill={!hideGraphToggle}
          onToggleGraph={onToggleGraph}
          onToggleSettings={onToggleSettings}
          onToggleMotor={onToggleMotor}
          className="mb-2 w-full"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5 sm:px-3 sm:pb-3">
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

        <ChannelStrip
          reading={reading}
          thermo={thermo}
          compact
          expandedChannel={isChannelBatchMode ? null : expandedChannel}
          onToggleChannel={isChannelBatchMode ? undefined : toggleChannel}
          channelDetail={channelDetail}
          channelDetailLoading={channelDetailShowLoading}
        />
      </div>
    </>
  );

  const graphPanel = hideGraphToggle ? null : (
    <BarnListPanelShell open={graphExpanded} panelKind="graph">
      {graphExpanded ? (
        <BarnListGraphPanel
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod ?? null}
          period={panelPeriodOverrides[reading.key] ?? bulkPeriod}
          onPeriodChange={(p) => onPanelPeriodChange?.(reading.key, p)}
          alarmSettings={alarmSettings}
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
        />
      ) : null}
    </BarnListPanelShell>
  );

  const motorPanel = (
    <BarnListPanelShell open={motorExpanded} panelKind="motor">
      {motorExpanded ? (
        <div className="barn-list-panel-stagger--motor space-y-2 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
          {CHANNELS.map((slot) => (
            <ChannelFanDropdown
              key={slot}
              slot={slot}
              reading={reading}
              detailReading={channelDetail}
              showLoading={channelDetailShowLoading}
            />
          ))}
        </div>
      ) : null}
    </BarnListPanelShell>
  );

  // 그리드 전용 — 설정/모터 패널을 카드 우측에 배치(열렸을 때만 우측 컬럼 표시).
  if (panelPlacement === "right") {
    const rightOpen = settingsExpanded || motorExpanded;

    // 데스크톱 그리드: 축사유형 카드 폭(1 컬럼) 단위로 정렬 — 카드 2칸 + 패널 남은 칸.
    if (typeof gridCols === "number" && gridCols >= 2) {
      const cardSpan = Math.min(2, gridCols);
      const panelSpan = Math.max(1, gridCols - cardSpan);
      return (
        <div
          className="grid min-w-0 items-start"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(4.75rem, 1fr))`,
            gap: "0.375rem",
          }}
        >
          <div
            className={cardClass}
            style={{ gridColumn: `span ${cardSpan}` }}
            data-controller-card-key={reading.key}
            data-controller-key={reading.controllerKey}
            data-list-mode={listMode}
          >
            {cardBody}
          </div>
          {rightOpen ? (
            <div
              className="min-w-0 overflow-hidden rounded-xl border bg-card"
              style={{ gridColumn: `span ${panelSpan}` }}
            >
              {settingsPanel}
              {motorPanel}
            </div>
          ) : null}
        </div>
      );
    }

    // 모바일/폴백 — 카드 하단 또는 우측 flex.
    return (
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start">
        <div
          className={cn(cardClass, "lg:w-80 lg:flex-none")}
          data-controller-card-key={reading.key}
          data-controller-key={reading.controllerKey}
          data-list-mode={listMode}
        >
          {cardBody}
        </div>
        {rightOpen ? (
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
            {settingsPanel}
            {motorPanel}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cardClass}
      data-controller-card-key={reading.key}
      data-controller-key={reading.controllerKey}
      data-list-mode={listMode}
    >
      {cardBody}
      {graphPanel}
      {settingsPanel}
      {motorPanel}
    </div>
  );
}
