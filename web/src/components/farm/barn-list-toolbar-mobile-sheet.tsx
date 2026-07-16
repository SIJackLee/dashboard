"use client";

import { useCallback, useMemo } from "react";
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
  panelPeriod,
  controllerTrendByPeriod,
}: {
  reading: BarnReading;
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  panelPeriod: TrendPeriodId;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
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

  const panelPeriod = reading
    ? (panelPeriodOverrides[reading.key] ?? bulkPeriod)
    : bulkPeriod;

  const handlePageSettled = useCallback(
    (page: ControllerMobileSheetPage) => {
      onPageSettled(page);
    },
    [onPageSettled],
  );

  if (!reading) return null;

  return (
    <BarnControllerMobileSheet
      open={open}
      initialPage={sheetPage}
      onClose={onClose}
      onPageSettled={handlePageSettled}
      reading={reading}
      pickerReadings={readings}
      selectedReadingKey={reading.key}
      onSelectReading={onSelectKey}
      showPickerAffiliation={showPickerAffiliation}
      controllerPage={
        <ControllerMobilePage
          metricsSection={
            <SheetMetricsBlock
              reading={reading}
              thermoSettings={thermoSettings}
              alarmSettings={alarmSettings}
              panelPeriod={panelPeriod}
              controllerTrendByPeriod={controllerTrendByPeriod}
            />
          }
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          thermoSettings={thermoSettings}
        />
      }
      settingsPage={
        <ControllerMobileSettingsPage
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
  );
}
