"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { getStallTypeName, normalizeStallTyCode } from "@/lib/data/stall-type";
import type {
  TrendControllerPeriodData,
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import {
  findStallTrendSeries,
  formatControllerNoLabel,
  resolveReadingAlarmThresholds,
  resolveReadingThermo,
} from "@/lib/farm/controller-summary-display";
import {
  fanBand,
  humidityBand,
  statBand,
  tempBand,
} from "@/lib/farm/severity-score";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { StackMetric } from "@/lib/farm/stack-metric";
import { SeverityHeatmap } from "@/components/farm/severity-heatmap";
import type { FarmMapControllerDetailData } from "@/components/farm/farm-map-controller-detail";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { GRAPH_BARS } from "@/lib/farm/trend-display-buckets";

export { GRAPH_BARS };

export type BarnGraphExpanded = { barnId: string; metricId: string };

type Options = {
  barns: BarnMapSnapshot[];
  /** 전체 3기간 축사 단위 시계열 — 개요 히트맵용. */
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  /** 컨트롤러 단위 3기간 시계열 — 상세(스몰멀티플)용. */
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  controller?: ControllerGridData | null;
  graphPeriod: TrendPeriodId;
  /** 그래프 모드 활성(요약+히트맵 병합, 일괄모드 아님). */
  enabled: boolean;
  /** 히트맵 행 라벨 — icon(기본) | text */
  heatmapLabelMode?: "text" | "icon";
};

/**
 * 그리드/모바일 공용 — 축사 카드별 심각도 히트맵과 확대 상세(스몰멀티플 + 목록 UI 재사용) 로직.
 * - 데이터(시계열)가 없는 축사는 히트맵을 만들지 않는다(카드에 요약만 표시).
 * - 히트맵 행(지표) 클릭은 `expanded`로 상위 보고되어 상세 패널이 열린다.
 */
export function useBarnGraphs({
  barns,
  trendByPeriod,
  controllerTrendByPeriod,
  controller,
  graphPeriod,
  enabled,
  heatmapLabelMode = "icon",
}: Options) {
  const [expanded, setExpanded] = useState<BarnGraphExpanded | null>(null);

  /** 축사 카드별 히트맵 — 데이터 없으면 항목을 만들지 않음(히트맵 미표시). */
  const { graphByBarnId, metricIdsByBarnId } = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const idsMap = new Map<string, string[]>();
    if (!enabled || !trendByPeriod) return { graphByBarnId: map, metricIdsByBarnId: idsMap };
    const readings = controller?.readings ?? [];
    const thermoSettings = controller?.thermoSettings ?? {};
    const alarmSettings = controller?.alarmSettings;
    for (const b of barns) {
      const entry = parseBarnCatalogKey(b.meta.id);
      const stallTyCode = entry?.stallTyCode ?? null;
      const stallNo = b.meta.stallNo ?? null;
      const series = findStallTrendSeries(
        trendByPeriod,
        graphPeriod,
        stallTyCode,
        stallNo,
      );
      // 데이터 없는 축사는 히트맵을 표시하지 않는다.
      if (!series) continue;
      const reading =
        readings.find(
          (r) =>
            normalizeStallTyCode(r.stallTyCode ?? "") ===
              normalizeStallTyCode(stallTyCode ?? "") &&
            (r.stallNo ?? "") === (stallNo ?? ""),
        ) ?? null;
      const thermo = reading
        ? resolveReadingThermo(reading, thermoSettings)
        : null;
      const thresholds = reading
        ? resolveReadingAlarmThresholds(reading, alarmSettings)
        : DEFAULT_ALARM_THRESHOLDS;
      const tBand = tempBand(thresholds);
      const hBand = humidityBand(thresholds);
      const fBand = fanBand(thermo);
      const metrics: StackMetric[] = [
        { id: "T", label: "온도", unit: "℃", values: series.temp, band: tBand },
        { id: "H", label: "습도", unit: "%", values: series.humidity, band: hBand },
        {
          id: "A",
          label: "A",
          unit: "%",
          values: series.fanIntake,
          band: fBand ?? statBand(series.fanIntake),
        },
        {
          id: "B",
          label: "B",
          unit: "%",
          values: series.fanExhaust,
          band: fBand ?? statBand(series.fanExhaust),
        },
        {
          id: "C",
          label: "C",
          unit: "%",
          values: series.fanSupply,
          band: fBand ?? statBand(series.fanSupply),
        },
      ];
      // 데이터가 없는 지표(행)는 히트맵에서 제외 — 값이 하나도 없으면 표시하지 않는다.
      const withData = metrics.filter((m) =>
        m.values.some((v) => v != null && Number.isFinite(v)),
      );
      if (withData.length === 0) continue;
      const controllerCount = readings.filter(
        (r) =>
          normalizeStallTyCode(r.stallTyCode ?? "") ===
            normalizeStallTyCode(stallTyCode ?? "") &&
          (r.stallNo ?? "") === (stallNo ?? ""),
      ).length;
      const barnId = b.meta.id;
      idsMap.set(barnId, withData.map((m) => m.id));
      map.set(
        barnId,
        <SeverityHeatmap
          metrics={withData}
          bars={GRAPH_BARS[graphPeriod]}
          caption={`축사 평균 · ${trendPeriodLabel(graphPeriod)}`}
          periodLabel={trendPeriodLabel(graphPeriod)}
          controllerCount={controllerCount > 0 ? controllerCount : undefined}
          labelMode={heatmapLabelMode}
          onExpand={(metricId) => setExpanded({ barnId, metricId })}
          activeMetricId={expanded?.barnId === barnId ? expanded.metricId : null}
        />,
      );
    }
    return { graphByBarnId: map, metricIdsByBarnId: idsMap };
  }, [enabled, graphPeriod, trendByPeriod, barns, controller, expanded, heatmapLabelMode]);

  /** 확대된 축사의 컨트롤러별 상세 데이터(스몰멀티플 + 목록 UI 재사용). */
  const detail = useMemo<FarmMapControllerDetailData | null>(() => {
    if (!enabled || !expanded) return null;
    const b = barns.find((x) => x.meta.id === expanded.barnId);
    if (!b) return null;
    const entry = parseBarnCatalogKey(b.meta.id);
    const stallTyCode = entry?.stallTyCode ?? null;
    const stallNo = b.meta.stallNo ?? null;
    const readings = controller?.readings ?? [];
    const thermoSettings = controller?.thermoSettings ?? {};
    const alarmSettings = controller?.alarmSettings;

    const ctrlStall = (() => {
      if (!controllerTrendByPeriod) return null;
      const data = controllerTrendByPeriod[graphPeriod];
      const sp = data?.sp.find(
        (g) =>
          normalizeStallTyCode(g.stallTyCode) ===
          normalizeStallTyCode(stallTyCode ?? ""),
      );
      return sp?.stalls.find((s) => s.stallNo === stallNo) ?? null;
    })();

    const controllers = (ctrlStall?.controllers ?? []).map((cs) => {
      const ctrlReading =
        readings.find((r) => r.controllerKey === cs.controllerKey) ?? null;
      const ctrlThermo = ctrlReading
        ? resolveReadingThermo(ctrlReading, thermoSettings)
        : null;
      const ctrlThresholds = ctrlReading
        ? resolveReadingAlarmThresholds(ctrlReading, alarmSettings)
        : DEFAULT_ALARM_THRESHOLDS;
      const ctrlTBand = tempBand(ctrlThresholds);
      const ctrlHBand = humidityBand(ctrlThresholds);
      const ctrlFBand = fanBand(ctrlThermo);

      return {
        key: cs.controllerKey,
        eqpmnNo: cs.eqpmnNo,
        label: formatControllerNoLabel(cs.eqpmnNo),
        reading: ctrlReading,
        metricsById: {
          T: { id: "T", label: "온도", unit: "℃", values: cs.temp, band: ctrlTBand },
          H: { id: "H", label: "습도", unit: "%", values: cs.humidity, band: ctrlHBand },
          A: {
            id: "A",
            label: "A",
            unit: "%",
            values: cs.fanIntake,
            band: ctrlFBand ?? statBand(cs.fanIntake),
          },
          B: {
            id: "B",
            label: "B",
            unit: "%",
            values: cs.fanExhaust,
            band: ctrlFBand ?? statBand(cs.fanExhaust),
          },
          C: {
            id: "C",
            label: "C",
            unit: "%",
            values: cs.fanSupply,
            band: ctrlFBand ?? statBand(cs.fanSupply),
          },
        } as Record<string, StackMetric>,
      };
    });

    return {
      barnId: b.meta.id,
      label: `${getStallTypeName(stallTyCode)} ${stallNo ?? ""}`.trim(),
      controllers,
    };
  }, [enabled, expanded, barns, controller, controllerTrendByPeriod, graphPeriod]);

  return { expanded, setExpanded, graphByBarnId, metricIdsByBarnId, detail };
}
