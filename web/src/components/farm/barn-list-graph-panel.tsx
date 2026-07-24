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
  humidityTrendLeftDomain,
  humidityTrendReferenceLines,
  humidityTrendSeries,
  stallTrendHasData,
  tempTrendLeftDomain,
  tempTrendReferenceLines,
  tempTrendSeries,
} from "@/lib/farm/trend-chart-series";
import {
  findControllerTrendSeries,
  formatControllerNoLabel,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { BarnChannelGraphSection } from "@/components/farm/barn-channel-graph-section";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import {
  downsampleTrendAxis,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  loading?: boolean;
  stale?: boolean;
  /** false면 채널 차트 숨김(그리드 설정/그래프 열림 시 카드 인라인과 중복 방지). */
  showChannelSection?: boolean;
  /** 모바일 sheet 컨트롤러 탭 / 설정 탭 — compact 차트·헤더 축소. */
  layout?: "default" | "sheetCompact";
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
  thermoSettings = {},
  loading = false,
  stale = false,
  showChannelSection = true,
  layout = "default",
}: Props) {
  const sheetCompact = layout === "sheetCompact";
  const tempChartHeight = sheetCompact ? 64 : 88;
  const humidityChartHeight = sheetCompact ? 56 : 72;
  const showChannels = showChannelSection && !sheetCompact;
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const tempDomain = tempTrendLeftDomain(thresholds);
  const humidityDomain = humidityTrendLeftDomain(thresholds);
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
    if (!sheetCompact) {
      return {
        categories: categoriesRaw,
        series: controllerSeries,
        tickEvery: tickEveryForPeriod(period, categoriesRaw.length),
      };
    }
    const { categories, columns } = downsampleTrendAxis(
      categoriesRaw,
      [controllerSeries.temp, controllerSeries.humidity],
      period,
    );
    return {
      categories,
      series: {
        ...controllerSeries,
        temp: columns[0] ?? controllerSeries.temp,
        humidity: columns[1] ?? controllerSeries.humidity,
      },
      tickEvery: tickEveryForDisplayBars(categories.length),
    };
  }, [hasDataRaw, controllerSeries, periodData, period, sheetCompact]);

  const categories = display.categories;
  const chartSeries = display.series;
  const tickEvery = display.tickEvery;
  const hasData = hasDataRaw && chartSeries != null;

  const sp = reading.stallTyCode
    ? normalizeStallTyCode(reading.stallTyCode)
    : "—";
  const stall = reading.stallNo?.trim() || "—";

  return (
    <div
      className={cn(
        sheetCompact
          ? "border-t bg-muted/20 px-3 py-2 pb-4"
          : "border-t bg-muted/20 px-3 py-3 sm:px-4",
      )}
      data-audit-region="barn-list-graph-panel"
      data-graph-layout={layout}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
          sheetCompact && "mb-2 gap-1.5",
        )}
      >
        <div className="min-w-0">
          {!sheetCompact ? (
            <>
              <p className={cn("font-semibold", dashboardTypography.sectionTitle)}>
                {sp} · 축사 {stall} · {formatControllerNoLabel(reading.eqpmnNo)}
              </p>
              <p className={cn(dashboardTypography.meta, "mt-0.5")}>
                컨트롤러 단위 · {trendPeriodLabel(period)}
              </p>
            </>
          ) : (
            <p className="text-[0.65rem] text-muted-foreground">
              추이 · {trendPeriodLabel(period)}
            </p>
          )}
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
          <div className={sheetCompact ? "space-y-2" : "space-y-3"}>
          <div
            className={cn(
              "rounded-lg border bg-background",
              sheetCompact ? "p-2" : "p-2.5 sm:p-3",
            )}
          >
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              환경 · 온도 (℃)
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={[tempTrendSeries(chartSeries!)]}
              height={tempChartHeight}
              leftUnit="℃"
              leftDomain={tempDomain}
              referenceLines={tempRefs}
              tickEvery={tickEvery}
              showLegend={!sheetCompact}
            />
            <p
              className={cn(
                "mb-1 text-xs font-semibold text-muted-foreground",
                sheetCompact ? "mt-1.5" : "mt-2",
              )}
            >
              환경 · 습도 (%)
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={[humidityTrendSeries(chartSeries!, thresholds)]}
              height={humidityChartHeight}
              leftUnit="%"
              leftDomain={humidityDomain}
              referenceLines={humidityRefs}
              tickEvery={tickEvery}
              showLegend={!sheetCompact}
            />
          </div>
          {showChannels ? (
            <BarnChannelGraphSection
              reading={reading}
              controllerTrendByPeriod={controllerTrendByPeriod}
              period={period}
              thermoSettings={thermoSettings}
            />
          ) : null}
        </div>
        </StaleWhileRevalidateShell>
      )}
    </div>
  );
}
