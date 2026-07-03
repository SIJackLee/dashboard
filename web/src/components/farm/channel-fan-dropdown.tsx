"use client";

import type { BarnReading } from "@/lib/data/iot";
import { TrendChart } from "@/components/trends/trend-chart";
import {
  channelBySlot,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import {
  channelPercentsFromReading,
  formatChannelPercent,
} from "@/lib/farm/controller-summary-display";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const COMPACT_LABEL = "text-xs font-semibold text-foreground";
const COMPACT_META = "text-xs text-muted-foreground";

function legacyFanSeriesForSlot(
  reading: BarnReading,
  slot: ChannelSlot
): number[] {
  if (slot === "A") return reading.fanIntakeSeries ?? [];
  if (slot === "B") return reading.fanExhaustSeries ?? [];
  return reading.fanSupplySeries ?? [];
}

function resolveChannelFanSeries(
  reading: BarnReading,
  slot: ChannelSlot
): number[] {
  if (reading.channels?.length) {
    const series = channelBySlot(reading.channels, slot)?.fanSeries;
    if (series?.length) return series;
  }
  return legacyFanSeriesForSlot(reading, slot);
}

type Props = {
  slot: ChannelSlot;
  reading: BarnReading;
  detailReading?: BarnReading;
  loading?: boolean;
  className?: string;
};

export function ChannelFanDropdown({
  slot,
  reading,
  detailReading,
  loading = false,
  className,
}: Props) {
  const merged = detailReading ?? reading;
  const series = resolveChannelFanSeries(merged, slot);
  const listSeries = resolveChannelFanSeries(reading, slot);
  const percents = channelPercentsFromReading(merged);
  const fanPct = formatChannelPercent(percents[slot]);
  const categories = series.map((_, index) => String(index + 1));

  if (loading && !listSeries.length) {
    return (
      <div
        className={cn(
          "mx-0 flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">채널 팬 출력 불러오는 중</span>
      </div>
    );
  }

  if (!series.length) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2",
          className
        )}
      >
        <p className={COMPACT_LABEL}>채널 {slot}</p>
        <p className={cn("mt-0.5", COMPACT_META)}>
          팬 출력 상세 없음 · 표시 {fanPct}
          {fanPct !== "—" ? "%" : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-sky-500/30 bg-sky-500/5 px-2.5 py-2",
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={COMPACT_LABEL}>채널 {slot}</p>
        <span className="shrink-0 rounded-full border border-sky-500/30 bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">
          {fanPct}
          {fanPct !== "—" ? "%" : ""}
        </span>
      </div>
      <TrendChart
        mode="bar"
        categories={categories}
        series={[
          {
            name: "팬 출력",
            data: series,
            color: "#0ea5e9",
          },
        ]}
        height={120}
        leftUnit="%"
        leftDomain={[0, 100]}
        tickEvery={series.length > 8 ? 2 : 1}
      />
    </div>
  );
}
