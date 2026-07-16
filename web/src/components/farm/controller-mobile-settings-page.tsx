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

/** 모바일 sheet page[1] — 상단 고정 온·습 추이 + 하단 설정(단일 세로 스크롤). */
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
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
      </div>
      <div
        className="barn-controller-mobile-sheet-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-t"
        data-audit-region="controller-mobile-sheet-settings"
      >
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
