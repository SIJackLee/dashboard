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
  envTrendReferenceLines,
  envTrendSeries,
  humidityTrendLeftDomain,
  stallTrendHasData,
  tempTrendLeftDomain,
} from "@/lib/farm/trend-chart-series";
import {
  findControllerTrendSeries,
  formatControllerNoLabel,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
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
  if (count <= 5) return 1;
  if (period === "24h") return Math.max(1, Math.ceil(count / 5));
  if (period === "7d") return Math.max(1, Math.ceil(count / 5));
  return Math.max(1, Math.ceil(count / 5));
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
  const envChartHeight = sheetCompact ? 88 : 112;
  const showChannels = showChannelSection && !sheetCompact;
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const tempDomain = tempTrendLeftDomain(thresholds);
  const humidityDomain = humidityTrendLeftDomain(thresholds);
  const envRefs = envTrendReferenceLines(thresholds);

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
    // sheetCompact뿐 아니라 데스크톱도 다운샘플 — 7d·30d X축·채널과 동일 해상도
    const { categories, columns } = downsampleTrendAxis(
      categoriesRaw,
      [
        controllerSeries.temp,
        controllerSeries.humidity,
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
        temp: columns[0] ?? controllerSeries.temp,
        humidity: columns[1] ?? controllerSeries.humidity,
        fanIntake: columns[2] ?? controllerSeries.fanIntake,
        fanExhaust: columns[3] ?? controllerSeries.fanExhaust,
        fanSupply: columns[4] ?? controllerSeries.fanSupply,
      },
      tickEvery: tickEveryForDisplayBars(categories.length),
    };
  }, [hasDataRaw, controllerSeries, categoriesRaw, period]);

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
      data-tour-id="list-graph-panel"
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
              환경 · 온·습도
            </p>
            <TrendChart
              mode="line"
              categories={categories}
              series={envTrendSeries(chartSeries!, thresholds)}
              height={envChartHeight}
              leftUnit="℃"
              rightUnit="%"
              leftDomain={tempDomain}
              rightDomain={humidityDomain}
              referenceLines={envRefs}
              tickEvery={tickEvery}
              period={period}
              showLegend={!sheetCompact}
            />
          </div>
          {showChannels ? (
            <BarnChannelTrendPanel
              reading={reading}
              controllerTrendByPeriod={controllerTrendByPeriod}
              period={period}
              thermoSettings={thermoSettings}
              layout="overlay"
            />
          ) : null}
        </div>
        </StaleWhileRevalidateShell>
      )}
    </div>
  );
}
