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
  resolveReadingChannelThermo,
} from "@/lib/farm/controller-summary-display";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import {
  downsampleTrendAxis,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { cn } from "@/lib/utils";
import type { ChannelSlot } from "@/lib/data/iot-channel";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 그리드 카드 하단 인라인 — 축소 높이·라벨. */
  compact?: boolean;
  className?: string;
};

/** 컨트롤러 채널 A/B/C 추이 — 목록·그리드 인라인 공용. */
export function BarnChannelGraphSection({
  reading,
  controllerTrendByPeriod,
  period,
  thermoSettings = {},
  compact = false,
  className,
}: Props) {
  const thermoByChannel = useMemo(() => {
    const slots: ChannelSlot[] = ["A", "B", "C"];
    const out: Partial<
      Record<ChannelSlot, ReturnType<typeof resolveReadingChannelThermo>>
    > = {};
    for (const slot of slots) {
      out[slot] = resolveReadingChannelThermo(reading, thermoSettings, slot);
    }
    return out;
  }, [reading, thermoSettings]);

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

  const categoriesRaw = periodData?.categories ?? [];
  const hasDataRaw =
    stallTrendHasData(controllerSeries) && categoriesRaw.length > 0;

  const display = useMemo(() => {
    if (!hasDataRaw || !controllerSeries) {
      return {
        categories: categoriesRaw,
        series: controllerSeries,
        tickEvery: 1,
      };
    }
    // 7d/30d 원본 버킷(수 백)을 그대로 그리면 X축이 겹침 — GRAPH_BARS로 다운샘플
    const { categories, columns } = downsampleTrendAxis(
      categoriesRaw,
      [
        controllerSeries.fanIntake,
        controllerSeries.fanExhaust,
        controllerSeries.fanSupply,
      ],
      period,
    );
    return {
      categories,
      series: {
        ...controllerSeries,
        fanIntake: columns[0] ?? controllerSeries.fanIntake,
        fanExhaust: columns[1] ?? controllerSeries.fanExhaust,
        fanSupply: columns[2] ?? controllerSeries.fanSupply,
      },
      tickEvery: tickEveryForDisplayBars(categories.length),
    };
  }, [hasDataRaw, controllerSeries, categoriesRaw, period]);

  const fanSeries = useMemo(
    () =>
      display.series
        ? channelFanTrendSeries(display.series, thermoByChannel)
        : [],
    [display.series, thermoByChannel]
  );
  const fanRefs = useMemo(() => {
    const seen = new Set<string>();
    return fanSeries.flatMap((s) => {
      if (!s.band) return [];
      const key = `${s.band.lo}:${s.band.hi}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return fanTrendReferenceLines(s.band);
    });
  }, [fanSeries]);

  const chartHeight = compact ? 72 : 80;

  if (!hasDataRaw || !display.series) {
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
        categories={display.categories}
        series={fanSeries}
        height={chartHeight}
        leftUnit="%"
        leftDomain={[0, 100]}
        referenceLines={fanRefs}
        tickEvery={display.tickEvery}
        period={period}
      />
    </div>
  );
}
