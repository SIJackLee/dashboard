"use client";

import { useMemo, useRef } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  DEFAULT_TREND_PERIOD,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import {
  BarnControllerMobileSheet,
} from "@/components/farm/barn-controller-mobile-sheet";
import { ControllerMobilePage } from "@/components/farm/controller-mobile-page";
import { ControllerMobileSettingsPage } from "@/components/farm/controller-mobile-settings-page";
import {
  ChannelStrip,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";

type Props = {
  open: boolean;
  readings: BarnReading[];
  selectedKey: string | null;
  sheetPage: ControllerMobileSheetPage;
  onSelectKey: (key: string) => void;
  onPageSettled: (page: ControllerMobileSheetPage) => void;
  onClose: () => void;
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  showPickerAffiliation?: boolean;
};

function SheetMetricsBlock({
  reading,
  thermoSettings,
  alarmSettings,
}: {
  reading: BarnReading;
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
}) {
  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  const setpoint = thermo?.setpointTemp;
  const setDev = thermo?.tempDeviation;

  return (
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
}

/** 모바일 목록 Graph/Set — 단일 bottom sheet + 상단 swipe picker */
export function BarnListToolbarMobileSheet({
  open,
  readings,
  selectedKey,
  sheetPage,
  onSelectKey,
  onPageSettled,
  onClose,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
  bulkPeriod = DEFAULT_TREND_PERIOD,
  panelPeriodOverrides = {},
  onPanelPeriodChange,
  showPickerAffiliation = true,
}: Props) {
  const reading = useMemo(
    () => readings.find((r) => r.key === selectedKey) ?? null,
    [readings, selectedKey],
  );

  /** key 전환 중 reading이 잠깐 비어도 Dialog를 언마운트하지 않음 */
  const lastReadingRef = useRef<BarnReading | null>(null);
  if (reading) lastReadingRef.current = reading;
  const displayReading = reading ?? lastReadingRef.current;

  const panelPeriod = displayReading
    ? (panelPeriodOverrides[displayReading.key] ?? bulkPeriod)
    : bulkPeriod;

  if (!displayReading) return null;

  return (
    <BarnControllerMobileSheet
      open={open}
      initialPage={sheetPage}
      onClose={onClose}
      onPageSettled={onPageSettled}
      reading={displayReading}
      pickerReadings={readings}
      selectedReadingKey={selectedKey ?? displayReading.key}
      onSelectReading={onSelectKey}
      showPickerAffiliation={showPickerAffiliation}
      controllerPage={
        <ControllerMobilePage
          key={displayReading.key}
          metricsSection={
            <SheetMetricsBlock
              reading={displayReading}
              thermoSettings={thermoSettings}
              alarmSettings={alarmSettings}
            />
          }
          reading={displayReading}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          thermoSettings={thermoSettings}
        />
      }
      settingsPage={
        <ControllerMobileSettingsPage
          key={displayReading.key}
          reading={displayReading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          onPeriodChange={(p) => onPanelPeriodChange?.(displayReading.key, p)}
          trendLoading={trendLoading}
          trendStale={trendStale}
        />
      }
    />
  );
}
