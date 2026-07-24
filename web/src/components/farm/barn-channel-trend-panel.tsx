"use client";

import { useMemo } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { CHANNELS } from "@/lib/farm/controller-summary-display";
import {
  channelPercentsFromReading,
  findControllerTrendSeries,
  formatChannelPercent,
  resolveReadingChannelThermo,
} from "@/lib/farm/controller-summary-display";
import {
  channelSlotTrendSeries,
  fanTrendReferenceLines,
  stallTrendHasData,
} from "@/lib/farm/trend-chart-series";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import {
  downsampleTrendAxis,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** split = A/B/C 각각 · single = 한 채널만 (ChannelStrip 펼침). */
  layout?: "split" | "single";
  slot?: ChannelSlot;
  compact?: boolean;
  /** stack 모바일 — 차트 높이·tick 더 축소. */
  dense?: boolean;
  className?: string;
};

function tickEveryForPeriod(
  period: TrendPeriodId,
  count: number,
  dense = false
): number {
  if (dense) {
    if (count <= 6) return 1;
    if (period === "24h") return 12;
    if (period === "7d") return 10;
    return 8;
  }
  if (count <= 12) return 1;
  if (period === "24h") return 8;
  if (period === "7d") return 7;
  return 5;
}

function ChannelSlotTrendChart({
  reading,
  slot,
  controllerSeries,
  categories,
  thermo,
  tickEvery,
  compact,
  dense,
}: {
  reading: BarnReading;
  slot: ChannelSlot;
  controllerSeries: NonNullable<ReturnType<typeof findControllerTrendSeries>>;
  categories: string[];
  thermo: ReturnType<typeof resolveReadingChannelThermo>;
  tickEvery: number;
  compact?: boolean;
  dense?: boolean;
}) {
  const series = channelSlotTrendSeries(controllerSeries, slot, thermo);
  const fanRefs = series.band ? fanTrendReferenceLines(series.band) : [];
  const pct = formatChannelPercent(channelPercentsFromReading(reading)[slot]);
  const hasPoint = series.data.some((v) => v != null && Number.isFinite(v));

  if (!hasPoint) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2",
          compact && "py-1.5"
        )}
      >
        <p className="text-xs font-semibold">채널 {slot}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          추이 없음 · 현재 {pct}
          {pct !== "—" ? "%" : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-2",
        compact && "py-1.5"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className={cn("font-semibold", compact ? "text-[0.65rem]" : "text-xs")}>
          채널 {slot}
        </p>
        <span className="shrink-0 rounded-full border border-sky-500/30 bg-background px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums sm:text-xs">
          {pct}
          {pct !== "—" ? "%" : ""}
        </span>
      </div>
      <TrendChart
        mode="line"
        categories={categories}
        series={[series]}
        height={dense ? 48 : compact ? 64 : 72}
        leftUnit="%"
        leftDomain={[0, 100]}
        referenceLines={fanRefs}
        tickEvery={tickEvery}
      />
    </div>
  );
}

/** 그래프(채널) pill — 채널 A/B/C RPC 트렌드 (bar 그래프 대체). */
export function BarnChannelTrendPanel({
  reading,
  controllerTrendByPeriod,
  period,
  thermoSettings = {},
  layout = "split",
  slot,
  compact = false,
  dense = false,
  className,
}: Props) {
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
        tickEvery: tickEveryForPeriod(period, categoriesRaw.length),
      };
    }
    if (!dense) {
      return {
        categories: categoriesRaw,
        series: controllerSeries,
        tickEvery: tickEveryForPeriod(period, categoriesRaw.length, false),
      };
    }
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
  }, [hasDataRaw, controllerSeries, periodData, period, dense]);

  const categories = display.categories;
  const chartSeries = display.series;
  const tickEvery = display.tickEvery;
  const hasData = hasDataRaw && chartSeries != null;

  if (!hasData || !chartSeries) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          compact ? "min-h-[4rem] py-4" : "py-8",
          className
        )}
      >
        채널 추이 데이터 없음
      </div>
    );
  }

  const slots: ChannelSlot[] =
    layout === "single" && slot ? [slot] : [...CHANNELS];

  return (
    <div className={cn("space-y-2", className)}>
      {layout === "split" ? (
        <p
          className={cn(
            "font-semibold text-muted-foreground",
            compact ? "text-[0.65rem]" : "text-xs"
          )}
        >
          그래프 · 채널 추이 · {trendPeriodLabel(period)}
        </p>
      ) : null}
      {slots.map((s) => (
        <ChannelSlotTrendChart
          key={s}
          reading={reading}
          slot={s}
          controllerSeries={chartSeries}
          categories={categories}
          thermo={resolveReadingChannelThermo(reading, thermoSettings, s)}
          tickEvery={tickEvery}
          compact={compact}
          dense={dense}
        />
      ))}
    </div>
  );
}
