"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import {
  ChannelStrip,
  ControllerAffiliationMarks,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type SheetTab = "status" | "settings";

export function BarnModelControllerSheet({
  reading,
  typeReadings,
  thermoSettings,
  alarmSettings,
  controllerTrendByPeriod,
  trendPeriod,
  onClose,
  onPrev,
  onNext,
}: {
  reading: BarnReading;
  typeReadings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendPeriod?: TrendPeriodId;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [tab, setTab] = useState<SheetTab>("status");
  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  return (
    <div className="flex max-h-[min(70vh,36rem)] w-80 flex-col overflow-hidden rounded-xl border bg-background/95 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        {onPrev ? (
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="이전 컨트롤러"
            onClick={onPrev}
          >
            <ChevronLeft className="size-4" strokeWidth={dashboardUi.iconStroke} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          <ControllerAffiliationMarks
            stallTyCode={reading.stallTyCode}
            stallNo={reading.stallNo}
            eqpmnNo={reading.eqpmnNo}
            compactType
          />
        </div>
        {onNext ? (
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="다음 컨트롤러"
            onClick={onNext}
          >
            <ChevronRight className="size-4" strokeWidth={dashboardUi.iconStroke} />
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="닫기"
          onClick={onClose}
        >
          <X className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
        </button>
      </div>
      <div className="flex gap-1 px-2 pt-2">
        {(
          [
            ["status", "현황"],
            ["settings", "설정"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              tab === id
                ? "bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "status" ? (
          <div>
            <EnvMetricPanel
              className="mb-2"
              offline={offline}
              setpoint={thermo?.setpointTemp}
              setDev={thermo?.tempDeviation}
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
              hideChannelTrendExpand
              controllerTrendByPeriod={controllerTrendByPeriod}
              period={trendPeriod}
              thermoSettings={thermoSettings}
            />
          </div>
        ) : (
          <BarnListAccordionPanel
            reading={reading}
            readings={typeReadings}
            thermoSettings={thermoSettings}
            alarmSettings={alarmSettings}
            canCommand={false}
            collapsibleSections
          />
        )}
      </div>
    </div>
  );
}
