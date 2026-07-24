"use client";

import type { ReactNode } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { BarnMotorTrendPanel } from "@/components/farm/barn-motor-trend-panel";

type Props = {
  /** 게이지·채널 (hideMotorExpand — 하단 split 추이가 기본 표시) */
  metricsSection: ReactNode;
  reading: BarnReading;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
};

/** 모바일 sheet page[0] — 상단 컨트롤러 요약 + 하단 채널 A/B/C 그래프 추이(기본 표시). */
export function ControllerMobilePage({
  metricsSection,
  reading,
  controllerTrendByPeriod = null,
  period,
  thermoSettings,
}: Props) {
  return (
    <div className="min-h-min w-full px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <div className="pb-2">{metricsSection}</div>
      <div
        className="border-t bg-muted/15 py-2 pb-1"
        data-audit-region="controller-mobile-sheet-motor-trend"
      >
        <BarnMotorTrendPanel
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={period}
          thermoSettings={thermoSettings}
          layout="split"
          compact
          dense
        />
      </div>
    </div>
  );
}
