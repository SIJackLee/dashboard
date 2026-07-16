"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import { BarnListGraphPanel } from "@/components/farm/barn-list-graph-panel";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
};

/** 모바일 sheet page[1] — 온·습 추이 + 설정 (sheet 전체 높이 단일 세로 스크롤). */
export function ControllerMobileSettingsPage({
  reading,
  readings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  controllerTrendByPeriod = null,
  period,
  onPeriodChange,
  trendLoading = false,
  trendStale = false,
}: Props) {
  return (
    <div
      className="min-h-min w-full pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      data-audit-region="controller-mobile-sheet-settings"
    >
      <BarnListGraphPanel
        reading={reading}
        controllerTrendByPeriod={controllerTrendByPeriod}
        period={period}
        onPeriodChange={onPeriodChange ?? (() => {})}
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        loading={trendLoading}
        stale={trendStale}
        showChannelSection={false}
        layout="sheetCompact"
      />
      <div className="border-t bg-muted/20">
        <BarnListAccordionPanel
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          collapsibleSections
        />
      </div>
    </div>
  );
}
