"use client";

import { useMemo } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import type { AlarmSettings } from "@/lib/data/alarms";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  findControllerTrendSeries,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import {
  downsampleTrendAxis,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { buildUnifiedBarnTrendSeries } from "@/lib/farm/unified-barn-trend-series";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { cn } from "@/lib/utils";

export type UnifiedBarnTrendControllerRef = {
  key: string;
  reading: BarnReading | null;
};

type Props = {
  label: string;
  controllers: UnifiedBarnTrendControllerRef[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  alarmSettings?: AlarmSettings;
  isMobileStack?: boolean;
  className?: string;
};

/**
 * detail-panel 하단 — 축사(패널) 컨트롤러 equally 평균 통합 추이.
 * 기존 detail-panel-charts 오버레이와 분리된 sibling.
 */
export function UnifiedBarnTrendPanel({
  label,
  controllers,
  controllerTrendByPeriod,
  period,
  alarmSettings,
  isMobileStack = false,
  className,
}: Props) {
  const thresholds = useMemo(() => {
    const withReading = controllers.find((c) => c.reading != null)?.reading;
    if (!withReading) return DEFAULT_ALARM_THRESHOLDS;
    return resolveReadingAlarmThresholds(withReading, alarmSettings);
  }, [controllers, alarmSettings]);

  const built = useMemo(() => {
    const periodData = controllerTrendByPeriod?.[period] ?? null;
    const categoriesRaw = periodData?.categories ?? [];
    if (!categoriesRaw.length) return null;

    const seriesList = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        return findControllerTrendSeries(
          controllerTrendByPeriod,
          period,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s != null);

    if (!seriesList.length) return null;

    const { categories, columns } = downsampleTrendAxis(
      categoriesRaw,
      seriesList.flatMap((s) => [
        s.fanIntake,
        s.fanExhaust,
        s.fanSupply,
        s.temp,
        s.humidity,
      ]),
      period,
    );

    const perCtrl = 5;
    const downsampledList = seriesList.map((s, idx) => {
      const base = idx * perCtrl;
      return {
        ...s,
        fanIntake: columns[base] ?? s.fanIntake,
        fanExhaust: columns[base + 1] ?? s.fanExhaust,
        fanSupply: columns[base + 2] ?? s.fanSupply,
        temp: columns[base + 3] ?? s.temp,
        humidity: columns[base + 4] ?? s.humidity,
      };
    });

    return buildUnifiedBarnTrendSeries(
      downsampledList,
      categories,
      thresholds,
    );
  }, [controllers, controllerTrendByPeriod, period, thresholds]);

  return (
    <div
      className={cn(
        "mt-2 space-y-2 rounded-md border bg-background p-2.5 sm:p-3",
        className,
      )}
      data-tour-id="detail-panel-unified-trend"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">통합 추이</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {label} · 평균 {built?.controllerCount ?? 0}대 ·{" "}
          {trendPeriodLabel(period)} · 좌 모터% · 우 온·습 n
        </span>
      </div>
      {built ? (
        <TrendChart
          mode="line"
          categories={built.categories}
          series={built.series}
          height={isMobileStack ? 148 : 176}
          leftUnit="%"
          rightUnit="n"
          leftDomain={built.leftDomain}
          rightDomain={built.rightDomain}
          period={period}
          tickEvery={tickEveryForDisplayBars(built.categories.length)}
          showLegend
          referenceLines={[
            {
              value: 0,
              axis: "right",
              color: "#94a3b8",
              label: "n0",
            },
            {
              value: 100,
              axis: "right",
              color: "#94a3b8",
              label: "n100",
            },
          ]}
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          통합 추이 데이터가 없습니다.
        </p>
      )}
      {built ? (
        <p className="text-[0.65rem] text-muted-foreground">
          온도 {built.tempRangeLabel} · 습도 {built.humidityRangeLabel} → 각
          구간을 0–100으로 정규화. 실험 플래그 ON 시에만 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}
