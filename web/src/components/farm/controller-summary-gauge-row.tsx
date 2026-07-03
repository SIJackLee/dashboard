"use client";

import { useCallback, useState } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
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
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  listMode?: BarnListViewMode;
  graphExpanded?: boolean;
  settingsExpanded?: boolean;
  motorExpanded?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  onToggleMotor?: () => void;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  className?: string;
};

/** PC·Mobile 공통 — 게이지·채널 고정 + 카드별 pill로 패널 드롭다운 */
export function ControllerSummaryGaugeRow({
  reading,
  readings,
  thermoSettings,
  alarmSettings,
  canCommand = false,
  listMode = "controller",
  graphExpanded = false,
  settingsExpanded = false,
  motorExpanded = false,
  onToggleGraph,
  onToggleSettings,
  onToggleMotor,
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
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

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card",
        statusRingClass(reading.status),
        graphExpanded && "ring-2 ring-sky-500/40",
        settingsExpanded && "ring-2 ring-violet-500/40",
        motorExpanded && "ring-2 ring-sky-500/25",
        className
      )}
      data-list-mode={listMode}
    >
      <div className="px-2.5 pt-2.5 sm:px-3 sm:pt-3">
        <ControllerSummaryHeader
          reading={reading}
          graphActive={graphExpanded}
          settingsActive={settingsExpanded}
          motorActive={motorExpanded}
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

      <BarnListPanelShell
        key={`${listMode}-graph`}
        open={graphExpanded}
        panelKind="graph"
      >
        {graphExpanded ? (
          <BarnListGraphPanel
            reading={reading}
            controllerTrendByPeriod={controllerTrendByPeriod ?? null}
            loading={trendLoading}
            stale={trendStale}
          />
        ) : null}
      </BarnListPanelShell>

      <BarnListPanelShell
        key={`${listMode}-settings`}
        open={settingsExpanded}
        panelKind="settings"
      >
        {settingsExpanded ? (
          <BarnListAccordionPanel
            reading={reading}
            readings={readings}
            thermoSettings={thermoSettings}
            alarmSettings={alarmSettings}
            canCommand={canCommand}
          />
        ) : null}
      </BarnListPanelShell>

      <BarnListPanelShell
        key={`${listMode}-motor`}
        open={motorExpanded}
        panelKind="motor"
      >
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
    </div>
  );
}
