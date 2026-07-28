"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import { UnifiedTrendPeriodBrush } from "@/components/farm/unified-trend-period-brush";
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
import {
  buildUnifiedBarnTrendSeries,
  DEFAULT_UNIFIED_LAYERS,
  pickUnifiedTrendLayers,
  SPLIT_Y,
  type UnifiedLayerFlags,
  type UnifiedLayerId,
} from "@/lib/farm/unified-barn-trend-series";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { motionClass } from "@/lib/ui/motion-classes";
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
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  isMobileStack?: boolean;
  /** 미지정 시 모바일 176 / 데스크톱 240 */
  chartHeight?: number;
  className?: string;
};

const LAYER_CHIPS: { id: UnifiedLayerId; label: string }[] = [
  { id: "motors", label: "모터 A·B·C" },
  { id: "temp", label: "온도" },
  { id: "hum", label: "습도" },
  { id: "band", label: "온도 산포" },
  { id: "cloud", label: "클라우드" },
];

/**
 * 차트 탭 통합 추이 — Y 상하 분리(아래 모터% · 위 온·습 원단위, 정규화 없음).
 */
export function UnifiedBarnTrendPanel({
  label,
  controllers,
  controllerTrendByPeriod,
  period,
  onPeriodChange,
  alarmSettings,
  isMobileStack = false,
  chartHeight,
  className,
}: Props) {
  const [layers, setLayers] = useState<UnifiedLayerFlags>(DEFAULT_UNIFIED_LAYERS);

  const thresholds = useMemo(() => {
    const withReading = controllers.find((c) => c.reading != null)?.reading;
    if (!withReading) return DEFAULT_ALARM_THRESHOLDS;
    return resolveReadingAlarmThresholds(withReading, alarmSettings);
  }, [controllers, alarmSettings]);

  /** 브러시 스파크라인 — 30d 모터 A(없으면 온도) 평균 개요 */
  const brushOverview = useMemo(() => {
    const periodData = controllerTrendByPeriod?.["30d"] ?? null;
    if (!periodData) return [];
    const seriesList = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        return findControllerTrendSeries(
          controllerTrendByPeriod,
          "30d",
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    if (!seriesList.length) return [];
    const len = Math.max(...seriesList.map((s) => s.fanIntake?.length ?? 0));
    const out: (number | null)[] = [];
    for (let i = 0; i < len; i++) {
      let sum = 0;
      let n = 0;
      for (const s of seriesList) {
        const v = s.fanIntake?.[i] ?? s.temp?.[i] ?? null;
        if (v != null && Number.isFinite(v)) {
          sum += v;
          n += 1;
        }
      }
      out.push(n > 0 ? sum / n : null);
    }
    return out;
  }, [controllers, controllerTrendByPeriod]);

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

  const picked = useMemo(
    () => (built ? pickUnifiedTrendLayers(built, layers) : null),
    [built, layers],
  );

  const toggleLayer = (id: UnifiedLayerId) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className={cn(
        "mt-2 space-y-2 rounded-md border bg-background p-2.5 sm:p-3",
        className,
      )}
      data-tour-id="farm-chart-unified-trend"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">통합 추이</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {label} · 집계 {built?.controllerCount ?? 0}대 ·{" "}
          {trendPeriodLabel(period)} · 위 온·습 · 아래 모터%
        </span>
      </div>

      {onPeriodChange ? (
        <UnifiedTrendPeriodBrush
          period={period}
          onPeriodChange={onPeriodChange}
          overviewValues={brushOverview}
        />
      ) : null}

      {built ? (
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="통합 추이 레이어"
        >
          {LAYER_CHIPS.map((chip) => {
            if (!built.available[chip.id]) return null;
            const on = layers[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLayer(chip.id)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
                  motionClass.microHover,
                  on
                    ? "border-sky-500/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                    : "border-border bg-muted/20 text-muted-foreground",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {built && picked && picked.series.length > 0 ? (
        <TrendChart
          mode="line"
          categories={built.categories}
          series={picked.series}
          envelopes={[
            {
              high: built.categories.map(() => SPLIT_Y.envLo),
              low: built.categories.map(() => SPLIT_Y.motorHi),
              axis: "left",
              fill: "#64748b",
              fillOpacity: 0.07,
            },
            ...picked.envelopes,
          ]}
          height={chartHeight ?? (isMobileStack ? 176 : 240)}
          leftUnit=""
          leftDomain={built.leftDomain}
          period={period}
          tickEvery={tickEveryForDisplayBars(built.categories.length)}
          showLegend
          showMarkers
          markerDensity="sparse"
          markerRadiusPx={isMobileStack ? 2.5 : 3}
          animate
          referenceLines={[
            {
              value: SPLIT_Y.motorHi,
              axis: "left",
              color: "#94a3b8",
              label: "모터%",
            },
            {
              value: SPLIT_Y.envLo,
              axis: "left",
              color: "#94a3b8",
              label: "온·습",
            },
          ]}
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? "표시할 레이어를 선택하세요."
            : "통합 추이 데이터가 없습니다."}
        </p>
      )}

      {built ? (
        <p className="text-[0.65rem] text-muted-foreground">
          Y 상하 분리 · 정규화 없음. 위=온℃·습%(0–100 절대) · 아래=모터%.
          알람 참고 {built.tempRangeLabel} / {built.humidityRangeLabel}.
          클라우드=온·습 사이 · 산포=컨트롤러 온도 min–max.
        </p>
      ) : null}
    </div>
  );
}
