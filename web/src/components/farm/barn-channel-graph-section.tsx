"use client";

import { useMemo } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { BarnReading } from "@/lib/data/iot";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import {
  channelFanTrendSeries,
  fanTrendReferenceLines,
  stallTrendHasData,
} from "@/lib/farm/trend-chart-series";
import {
  findControllerTrendSeries,
  resolveReadingThermo,
} from "@/lib/farm/controller-summary-display";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 그리드 카드 하단 인라인 — 축소 높이·라벨. */
  compact?: boolean;
  className?: string;
};

function tickEveryForPeriod(period: TrendPeriodId, count: number): number {
  if (count <= 12) return 1;
  if (period === "24h") return compactTickEvery(count, 8);
  if (period === "7d") return compactTickEvery(count, 7);
  return compactTickEvery(count, 5);
}

function compactTickEvery(count: number, base: number): number {
  return count <= 12 ? 1 : base;
}

/** 컨트롤러 채널 A/B/C 추이 — 목록·그리드 인라인 공용. */
export function BarnChannelGraphSection({
  reading,
  controllerTrendByPeriod,
  period,
  thermoSettings = {},
  compact = false,
  className,
}: Props) {
  const thermo = resolveReadingThermo(reading, thermoSettings);
  const periodData = controllerTrendByPeriod?.[period] ?? null;
  const controllerSeries = useMemo(
    () =>
      findControllerTrendSeries(
        controllerTrendByPeriod,
        period,
        reading.stallTyCode,
        reading.stallNo,
        reading.controllerKey
      ),
    [
      controllerTrendByPeriod,
      period,
      reading.stallTyCode,
      reading.stallNo,
      reading.controllerKey,
    ]
  );

  const fanSeries = useMemo(
    () =>
      controllerSeries ? channelFanTrendSeries(controllerSeries, thermo) : [],
    [controllerSeries, thermo]
  );
  const fanBand = fanSeries[0]?.band ?? null;
  const fanRefs = fanBand ? fanTrendReferenceLines(fanBand) : [];

  const categories = periodData?.categories ?? [];
  const hasData = stallTrendHasData(controllerSeries) && categories.length > 0;
  const tickEvery = tickEveryForPeriod(period, categories.length);
  const chartHeight = compact ? 72 : 80;

  if (!hasData) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          compact ? "min-h-[4.5rem]" : "py-6",
          className
        )}
      >
        채널 추이 데이터 없음
      </div>
    );
  }

  return (
    <div className={cn(compact ? "min-h-0" : "rounded-lg border bg-background p-2.5 sm:p-3", className)}>
      <p
        className={cn(
          "font-semibold text-muted-foreground",
          compact ? "mb-1 text-[0.65rem]" : "mb-1.5 text-xs"
        )}
      >
        채널 A, B, C (%)
        {compact ? (
          <span className="ml-1 font-normal opacity-80">
            · {trendPeriodLabel(period)}
          </span>
        ) : null}
      </p>
      <TrendChart
        mode="line"
        categories={categories}
        series={fanSeries}
        height={chartHeight}
        leftUnit="%"
        leftDomain={[0, 100]}
        referenceLines={fanRefs}
        tickEvery={tickEvery}
      />
    </div>
  );
}
