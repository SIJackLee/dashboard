"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  TrendChart,
  type TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
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
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  buildUnifiedBarnTrendSeries,
  DEFAULT_UNIFIED_LAYERS,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  needsHumidityBand,
  pickUnifiedTrendLayers,
  resolveSplitYLayout,
  trimPickedUnifiedTrend,
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
  /** 미지정 시 모바일 220 / 데스크톱 340 */
  chartHeight?: number;
  className?: string;
};

type LayerChip = { id: UnifiedLayerId; label: string };

const TEMP_SUB_CHIPS: LayerChip[] = [
  { id: "ema", label: "EMA" },
  { id: "dev", label: "편차" },
  { id: "band", label: "산포" },
];

const HUM_SUB_CHIPS: LayerChip[] = [
  { id: "humEma", label: "EMA" },
  { id: "humDev", label: "편차" },
  { id: "humBand", label: "산포" },
];

const MOTOR_SUB_CHIPS: LayerChip[] = [
  { id: "motorCh", label: "채널 A/B/C" },
];

function layerChipClass(on: boolean) {
  return cn(
    "rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
    motionClass.microHover,
    on
      ? "border-sky-500/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
      : "border-border bg-muted/20 text-muted-foreground",
  );
}

/**
 * 차트 탭 통합 추이 — 온도+편차 · 모터 max/채널 · 네비 브러시.
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
  /** 온도/습도/모터 하위 옵션 펼침 */
  const [tempMenuOpen, setTempMenuOpen] = useState(false);
  const [humMenuOpen, setHumMenuOpen] = useState(false);
  const [motorMenuOpen, setMotorMenuOpen] = useState(false);

  const thresholds = useMemo(() => {
    const withReading = controllers.find((c) => c.reading != null)?.reading;
    if (!withReading) return DEFAULT_ALARM_THRESHOLDS;
    return resolveReadingAlarmThresholds(withReading, alarmSettings);
  }, [controllers, alarmSettings]);

  const showHumBand = needsHumidityBand(layers);
  const layout = useMemo(
    () => resolveSplitYLayout(showHumBand),
    [showHumBand],
  );

  /** 브러시 스파크라인 — 30d 온도 평균(없으면 모터 max) */
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
    const len = Math.max(
      ...seriesList.map((s) =>
        Math.max(
          s.temp?.length ?? 0,
          s.fanIntake?.length ?? 0,
          s.fanExhaust?.length ?? 0,
          s.fanSupply?.length ?? 0,
        ),
      ),
    );
    const out: (number | null)[] = [];
    for (let i = 0; i < len; i++) {
      let tempSum = 0;
      let tempN = 0;
      let motorSum = 0;
      let motorN = 0;
      for (const s of seriesList) {
        const t = s.temp?.[i];
        if (t != null && Number.isFinite(t)) {
          tempSum += t;
          tempN += 1;
        }
        const slot: number[] = [];
        for (const v of [s.fanIntake?.[i], s.fanExhaust?.[i], s.fanSupply?.[i]]) {
          if (v != null && Number.isFinite(v)) slot.push(v);
        }
        if (slot.length) {
          motorSum += Math.max(...slot);
          motorN += 1;
        }
      }
      if (tempN > 0) {
        /* 브러시는 0~100 스케일 — 온도를 대략 0~40℃ → 0~100으로 투영 */
        out.push(Math.max(0, Math.min(100, (tempSum / tempN / 40) * 100)));
      } else if (motorN > 0) {
        out.push(motorSum / motorN);
      } else {
        out.push(null);
      }
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
      { showHum: showHumBand },
    );
  }, [controllers, controllerTrendByPeriod, period, thresholds, showHumBand]);

  const picked = useMemo(() => {
    if (!built) return null;
    const raw = pickUnifiedTrendLayers(built, layers);
    return trimPickedUnifiedTrend(built.categories, raw);
  }, [built, layers]);

  const chartCategories = picked?.categories ?? built?.categories ?? [];

  /** 우측 Y — 밴드별 모터%/온도℃/습도% 개별 상·하한. 알람 고정 스케일. */
  const scaleEdgeLabels = useMemo((): TrendScaleEdgeLabel[] => {
    if (!built) return [];
    const out: TrendScaleEdgeLabel[] = [];
    const push = (
      id: string,
      chartY: number | null,
      text: string,
      color: string,
      mark: "overline" | "underline",
      title: string,
      showLine: boolean,
    ) => {
      if (chartY == null || !Number.isFinite(chartY)) return;
      out.push({
        id,
        value: chartY,
        axis: "left",
        side: "right",
        text,
        color,
        mark,
        title,
        showLine,
      });
    };

    if (layers.motors && built.available.motors) {
      push(
        "motor-hi",
        mapMotorPctToSplitY(100, layout),
        "100%",
        "#64748b",
        "overline",
        "모터 상한",
        false,
      );
      push(
        "motor-lo",
        mapMotorPctToSplitY(0, layout),
        "0%",
        "#64748b",
        "underline",
        "모터 하한",
        false,
      );
    }
    if (layers.temp && built.available.temp) {
      push(
        "temp-hi",
        mapTempCToSplitY(
          thresholds.tempHigh,
          thresholds.tempLow,
          thresholds.tempHigh,
          layout,
        ),
        `${thresholds.tempHigh}℃`,
        TREND_CHART_COLORS.temp,
        "overline",
        "온도 상한(알람)",
        true,
      );
      push(
        "temp-lo",
        mapTempCToSplitY(
          thresholds.tempLow,
          thresholds.tempLow,
          thresholds.tempHigh,
          layout,
        ),
        `${thresholds.tempLow}℃`,
        TREND_CHART_COLORS.temp,
        "underline",
        "온도 하한(알람)",
        true,
      );
    }
    if (layers.hum || layers.humDev || layers.humBand || layers.humEma) {
      if (built.available.hum || built.available.humDev || built.available.humBand) {
        push(
          "hum-hi",
          mapHumPctToSplitY(
            thresholds.humidityHigh,
            thresholds.humidityLow,
            thresholds.humidityHigh,
            layout,
          ),
          `${thresholds.humidityHigh}%`,
          TREND_CHART_COLORS.humidity,
          "overline",
          "습도 상한(알람)",
          true,
        );
        push(
          "hum-lo",
          mapHumPctToSplitY(
            thresholds.humidityLow,
            thresholds.humidityLow,
            thresholds.humidityHigh,
            layout,
          ),
          `${thresholds.humidityLow}%`,
          TREND_CHART_COLORS.humidity,
          "underline",
          "습도 하한(알람)",
          true,
        );
      }
    }
    return out;
  }, [built, layers, thresholds, layout]);

  const toggleLayer = (id: UnifiedLayerId) => {
    setLayers((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (id === "motorCh" && next.motorCh) next.motors = true;
      /** 본선은 기본 유지 — 분석 칩만 토글 */
      if (id === "ema" || id === "dev" || id === "band") next.temp = true;
      if (id === "humEma" || id === "humDev" || id === "humBand") next.hum = true;
      return next;
    });
  };

  const tempSubActiveCount = TEMP_SUB_CHIPS.filter(
    (c) => built?.available[c.id] && layers[c.id],
  ).length;
  const humSubActiveCount = HUM_SUB_CHIPS.filter(
    (c) => built?.available[c.id] && layers[c.id],
  ).length;
  const motorSubActiveCount = MOTOR_SUB_CHIPS.filter(
    (c) => built?.available[c.id] && layers[c.id],
  ).length;

  const renderSubChip = (chip: LayerChip) => {
    if (!built?.available[chip.id]) return null;
    const on = layers[chip.id];
    return (
      <button
        key={chip.id}
        type="button"
        aria-pressed={on}
        onClick={() => toggleLayer(chip.id)}
        className={layerChipClass(on)}
      >
        {chip.label}
      </button>
    );
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
          {trendPeriodLabel(period)}
          {picked?.trimmed ? " · 실데이터 구간" : ""}
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
        <div className="space-y-1" aria-label="통합 추이 레이어">
          <div className="flex flex-wrap items-start gap-1" role="group">
            {built.available.temp ? (
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={tempMenuOpen}
                  aria-controls="unified-temp-sublayers"
                  onClick={() => setTempMenuOpen((o) => !o)}
                  className={cn(
                    layerChipClass(true),
                    "inline-flex items-center gap-0.5",
                  )}
                  title="온도 옵션 펼치기"
                >
                  온도
                  {tempSubActiveCount > 0 ? (
                    <span className="tabular-nums opacity-70">
                      ·{tempSubActiveCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-3 opacity-70 transition-transform duration-motion-fast",
                      tempMenuOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {tempMenuOpen ? (
                  <div
                    id="unified-temp-sublayers"
                    className="flex flex-wrap gap-1 pl-1"
                    role="group"
                    aria-label="온도 상세 레이어"
                  >
                    {TEMP_SUB_CHIPS.map(renderSubChip)}
                  </div>
                ) : null}
              </div>
            ) : null}

            {built.available.hum ? (
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={humMenuOpen}
                  aria-controls="unified-hum-sublayers"
                  onClick={() => setHumMenuOpen((o) => !o)}
                  className={cn(
                    layerChipClass(true),
                    "inline-flex items-center gap-0.5",
                  )}
                  title="습도 옵션 펼치기"
                >
                  습도
                  {humSubActiveCount > 0 ? (
                    <span className="tabular-nums opacity-70">
                      ·{humSubActiveCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-3 opacity-70 transition-transform duration-motion-fast",
                      humMenuOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {humMenuOpen ? (
                  <div
                    id="unified-hum-sublayers"
                    className="flex flex-wrap gap-1 pl-1"
                    role="group"
                    aria-label="습도 상세 레이어"
                  >
                    {HUM_SUB_CHIPS.map(renderSubChip)}
                  </div>
                ) : null}
              </div>
            ) : null}

            {built.available.motors ? (
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={motorMenuOpen}
                  aria-controls="unified-motor-sublayers"
                  onClick={() => {
                    setMotorMenuOpen((o) => !o);
                    setLayers((prev) =>
                      prev.motors ? prev : { ...prev, motors: true },
                    );
                  }}
                  className={cn(
                    layerChipClass(true),
                    "inline-flex items-center gap-0.5",
                  )}
                  title="모터 옵션 펼치기"
                >
                  모터
                  {motorSubActiveCount > 0 ? (
                    <span className="tabular-nums opacity-70">
                      ·{motorSubActiveCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-3 opacity-70 transition-transform duration-motion-fast",
                      motorMenuOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {motorMenuOpen ? (
                  <div
                    id="unified-motor-sublayers"
                    className="flex flex-wrap gap-1 pl-1"
                    role="group"
                    aria-label="모터 상세 레이어"
                  >
                    {MOTOR_SUB_CHIPS.map(renderSubChip)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {built &&
      picked &&
      (picked.series.length > 0 || picked.histograms.length > 0) ? (
        <TrendChart
          mode="line"
          categories={chartCategories}
          series={picked.series}
          envelopes={picked.envelopes}
          histograms={picked.histograms}
          height={chartHeight ?? (isMobileStack ? 220 : 340)}
          leftUnit=""
          leftDomain={built.leftDomain}
          period={period}
          tickEvery={tickEveryForDisplayBars(chartCategories.length)}
          showLegend
          showMarkers
          markerDensity={period === "24h" ? "all" : "sparse"}
          markerRadiusPx={isMobileStack ? 2.8 : 3.2}
          animate
          scaleEdgeLabels={scaleEdgeLabels}
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
          온도·습도 클릭=옵션 펼침 · 편차 진함=알람 밖 · Y축 알람 고정
        </p>
      ) : null}
    </div>
  );
}
