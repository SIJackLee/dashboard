"use client";

import { useMemo } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import { GraphPanelSkeleton } from "@/components/common/loading-skeletons";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { TrendPeriodToggle } from "@/components/farm/trend-period-toggle";
import {
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  channelFanTrendSeries,
  envTrendSeries,
  humidityOnlyTrendSeries,
  stallTrendHasData,
  tempTrendLeftDomain,
  tempTrendReferenceLines,
  humidityTrendReferenceLines,
} from "@/lib/farm/trend-chart-series";
import {
  findControllerTrendSeries,
  formatControllerNoLabel,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  loading?: boolean;
  stale?: boolean;
};

function tickEveryForPeriod(period: TrendPeriodId, count: number): number {
  if (count <= 12) return 1;
  if (period === "24h") return 8;
  if (period === "7d") return 7;
  return 5;
}

export function BarnListGraphPanel({
  reading,
  controllerTrendByPeriod,
  period,
  onPeriodChange,
  alarmSettings,
  loading = false,
  stale = false,
}: Props) {
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const tempDomain = tempTrendLeftDomain(thresholds);
  const tempRefs = tempTrendReferenceLines(thresholds);
  const humidityRefs = humidityTrendReferenceLines(thresholds);

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

  const categories = periodData?.categories ?? [];
  const hasData = stallTrendHasData(controllerSeries) && categories.length > 0;
  const tickEvery = tickEveryForPeriod(period, categories.length);

  const sp = reading.stallTyCode
    ? normalizeStallTyCode(reading.stallTyCode)
    : "—";
  const stall = reading.stallNo?.trim() || "—";

  return (
    <div
      className="border-t bg-muted/20 px-3 py-3 sm:px-4"
      data-audit-region="barn-list-graph-panel"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={cn("font-semibold", dashboardTypography.sectionTitle)}>
            {sp} · 축사 {stall} · {formatControllerNoLabel(reading.eqpmnNo)}
          </p>
        </div>
        <TrendPeriodToggle value={period} onChange={onPeriodChange} />
      </div>

      {!hasData ? (
        loading && !controllerTrendByPeriod ? (
          <GraphPanelSkeleton />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            선택한 기간에 수신된 데이터가 없습니다.
          </p>
        )
      ) : (
        <StaleWhileRevalidateShell stale={stale}>
          <div className="space-y-3">
          <div className="rounded-lg border bg-background p-2.5 sm:p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              환경 · 온도 (℃)
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={[envTrendSeries(controllerSeries!)[0]!]}
              height={88}
              leftUnit="℃"
              leftDomain={tempDomain}
              referenceLines={tempRefs}
              tickEvery={tickEvery}
            />
            <p className="mb-1 mt-2 text-xs font-semibold text-muted-foreground">
              환경 · 습도 (%)
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={[humidityOnlyTrendSeries(controllerSeries!)]}
              height={72}
              leftUnit="%"
              leftDomain={[0, 100]}
              referenceLines={humidityRefs}
              tickEvery={tickEvery}
            />
          </div>
          <div className="rounded-lg border bg-background p-2.5 sm:p-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              채널 A, B, C (%)
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={channelFanTrendSeries(controllerSeries!)}
              height={80}
              leftUnit="%"
              leftDomain={[0, 100]}
              tickEvery={tickEvery}
            />
          </div>
        </div>
        </StaleWhileRevalidateShell>
      )}
    </div>
  );
}
