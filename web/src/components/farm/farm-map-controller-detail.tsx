"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { SEV_COLOR } from "@/lib/farm/severity-score";
import { METRIC_ID_COLORS } from "@/lib/farm/trend-chart-series";
import {
  currentStackMetricValue,
  formatStackMetricValue,
  worstSingleStackMetric,
  type StackMetric,
} from "@/lib/farm/stack-metric";
import { ControllerSummaryGaugeRow } from "./controller-summary-gauge-row";
import { MetricLineChart } from "./severity-heatmap";
import { cn } from "@/lib/utils";

/** 지표(행) 탭 — 히트맵 행과 동일한 순서/라벨. */
const METRIC_TABS: { id: string; label: string }[] = [
  { id: "T", label: "온도" },
  { id: "H", label: "습도" },
  { id: "A", label: "A" },
  { id: "B", label: "B" },
  { id: "C", label: "C" },
];

export type FarmMapControllerDetailController = {
  key: string;
  eqpmnNo: string;
  label: string;
  reading: BarnReading | null;
  /** 지표 id(T/H/A/B/C) → 시계열+밴드. */
  metricsById: Record<string, StackMetric>;
};

export type FarmMapControllerDetailData = {
  barnId: string;
  label: string;
  controllers: FarmMapControllerDetailController[];
};

type Props = {
  /** 축사 표기 (예: "임신사 01"). */
  label: string;
  /** 클릭한 히트맵 행 지표(T/H/A/B/C). */
  metricId: string;
  controllers: FarmMapControllerDetailController[];
  /** 그리드 보드 컬럼 수 — 내부 카드를 축사유형 카드 폭(1 컬럼)에 정렬. 모바일은 미전달. */
  gridCols?: number;
  period: TrendPeriodId;
  bars: number;
  /** 목록 UI 완전재사용(②A)용 데이터. */
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  onChangeMetric: (metricId: string) => void;
  onClose: () => void;
};

/**
 * 그리드 하단 전체폭(①B) 상세 패널.
 * - 스몰멀티플: 클릭한 지표(온도/습도/A/B/C)를 컨트롤러별 작은 그래프로 나란히.
 * - 컨트롤러 선택 시 목록 UI(ControllerSummaryGaugeRow · ②A)를 인라인 재사용(라우팅 없음).
 */
export function FarmMapControllerDetail({
  label,
  metricId,
  controllers,
  gridCols,
  period,
  readings,
  thermoSettings,
  commands,
  canCommand,
  alarmSettings,
  controllerTrendByPeriod,
  onChangeMetric,
  onClose,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // R4(그리드 전용) — 상단 오버레이가 그래프를 대체하므로 설정/모터만 토글.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [motorOpen, setMotorOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // R3 — 데이터가 존재하는 지표만 탭/스몰멀티플에 노출.
  const availableMetricIds = useMemo(() => {
    const has = (id: string) =>
      controllers.some((c) => {
        const m = c.metricsById[id];
        return (
          Boolean(m) && m.values.some((v) => v != null && Number.isFinite(v))
        );
      });
    return METRIC_TABS.filter((t) => has(t.id)).map((t) => t.id);
  }, [controllers]);
  const effectiveMetricId = availableMetricIds.includes(metricId)
    ? metricId
    : (availableMetricIds[0] ?? metricId);
  const metricLabel =
    METRIC_TABS.find((t) => t.id === effectiveMetricId)?.label ??
    effectiveMetricId;

  // 패널이 나타나면 화면에 보이도록 스크롤(투어 중에는 4→5 스크롤 위치 유지).
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      document.querySelector('[aria-label="기능 안내 투어"]')
    ) {
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // 선택 컨트롤러가 목록에서 사라지면 파생값이 자동으로 null이 된다(별도 정리 불필요).
  const selected = useMemo(
    () => controllers.find((c) => c.key === selectedKey) ?? null,
    [controllers, selectedKey],
  );

  const selectController = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
    setSettingsOpen(false);
    setMotorOpen(false);
  };

  // 컨트롤러 수에 따른 스몰멀티플 밀도 — 많을수록 그래프 높이를 줄인다.
  const count = controllers.length;
  // 그리드(데스크톱): 카드 폭을 축사유형 카드(1 컬럼)에 정렬. 미전달(모바일): 반응형 열.
  const useColGrid = typeof gridCols === "number" && gridCols >= 1;
  const gridColsClass =
    count <= 2
      ? "sm:grid-cols-2"
      : count <= 6
        ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  const chartHeight = count <= 2 ? 84 : count <= 6 ? 64 : 48;
  const dense = count > 6;

  return (
    <div
      ref={rootRef}
      className="farm-heat-morph border-t bg-muted/20 px-3 py-3"
      data-tour-id="detail-panel"
    >
      {/* 헤더: 축사 · 지표 탭 · 닫기 */}
      <div
        className="mb-2.5 flex flex-wrap items-center gap-2"
        data-tour-id="detail-panel-header"
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          · {metricLabel} 추이 · 컨트롤러 {controllers.length}대
        </span>
        <div
          className="ml-1 inline-flex overflow-hidden rounded-md border bg-background text-[0.7rem]"
          role="group"
          aria-label="지표"
        >
          {METRIC_TABS.filter((t) => availableMetricIds.includes(t.id)).map(
            (t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeMetric(t.id)}
                className={cn(
                  "px-2 py-1 font-medium transition-colors",
                  effectiveMetricId === t.id
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full border px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          닫기
        </button>
      </div>

      {controllers.length === 0 ? (
        <div className="rounded-md border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
          컨트롤러 시계열을 불러오는 중이거나 데이터가 없습니다.
        </div>
      ) : (
        <>
          {/* 스몰멀티플 — 클릭 지표를 컨트롤러별로 나란히. 그리드에선 축사 카드 폭(1 컬럼)에 정렬. */}
          <div
            className={cn(
              "grid",
              !useColGrid && cn("grid-cols-1 gap-2", gridColsClass),
            )}
            data-tour-id="detail-panel-charts"
            style={
              useColGrid
                ? {
                    gridTemplateColumns: `repeat(${gridCols}, minmax(4.75rem, 1fr))`,
                    gap: "0.375rem",
                  }
                : undefined
            }
          >
            {controllers.map((c, chartIndex) => {
              const metric = c.metricsById[effectiveMetricId];
              const cur = metric ? currentStackMetricValue(metric.values) : null;
              const worst = metric ? worstSingleStackMetric(metric) : "normal";
              const isSel = c.key === selectedKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  data-tour-id={
                    chartIndex === 0 ? "detail-panel-chart-first" : undefined
                  }
                  onClick={() => selectController(c.key)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex flex-col rounded-md border bg-background p-2 text-left transition-colors hover:border-sky-400",
                    isSel && "border-sky-500 ring-2 ring-sky-500/30",
                    !isSel && worst === "warning" && "border-red-500/50",
                    !isSel && worst === "caution" && "border-amber-500/50",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 shrink-0 rounded-sm"
                      style={{ background: SEV_COLOR[worst] }}
                      aria-hidden
                    />
                    <span className="truncate text-[0.7rem] font-semibold">
                      {c.label}
                    </span>
                    {!dense ? (
                      <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                        EQP{c.eqpmnNo}
                      </span>
                    ) : null}
                    <span
                      className="ml-auto shrink-0 text-[0.7rem] font-semibold"
                      style={{ color: SEV_COLOR[worst] }}
                    >
                      {formatStackMetricValue(cur, metric?.unit)}
                    </span>
                  </div>
                  {metric ? (
                    <MetricLineChart
                      values={metric.values}
                      band={metric.band}
                      height={chartHeight}
                      color={METRIC_ID_COLORS[effectiveMetricId] ?? "#0ea5e9"}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-[0.65rem] text-muted-foreground"
                      style={{ height: chartHeight }}
                    >
                      데이터 없음
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[0.65rem] text-muted-foreground">
            그래프를 클릭하면 해당 컨트롤러의 목록 상세가 아래에 열립니다.
          </p>

          {/* 2단계 — 선택 컨트롤러의 목록 UI 완전재사용(②A) */}
          {selected ? (
            selected.reading ? (
              <div className="farm-heat-morph mt-3">
                <ControllerSummaryGaugeRow
                  key={selected.key}
                  reading={selected.reading}
                  readings={readings}
                  thermoSettings={thermoSettings}
                  commands={commands}
                  canCommand={canCommand}
                  alarmSettings={alarmSettings}
                  controllerTrendByPeriod={controllerTrendByPeriod}
                  bulkPeriod={period}
                  hideGraphToggle
                  panelPlacement="right"
                  gridCols={gridCols}
                  graphExpanded={false}
                  settingsExpanded={settingsOpen}
                  motorExpanded={motorOpen}
                  onToggleSettings={() => setSettingsOpen((v) => !v)}
                  onToggleMotor={() => setMotorOpen((v) => !v)}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-md border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                이 컨트롤러의 실시간 판독값을 찾을 수 없습니다.
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
