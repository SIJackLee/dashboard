"use client";

/**
 * @deprecated Prefer BarnChannelTrendPanel layout="overlay".
 */
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { BarnReading } from "@/lib/data/iot";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  compact?: boolean;
  className?: string;
};

export function BarnChannelGraphSection({
  reading,
  controllerTrendByPeriod,
  period,
  thermoSettings = {},
  compact = false,
  className,
}: Props) {
  return (
    <BarnChannelTrendPanel
      reading={reading}
      controllerTrendByPeriod={controllerTrendByPeriod}
      period={period}
      thermoSettings={thermoSettings}
      layout="overlay"
      compact={compact}
      className={className}
    />
  );
}
