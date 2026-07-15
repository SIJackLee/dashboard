"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import {
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { GRAPH_BARS, useBarnGraphs } from "@/lib/farm/use-barn-graphs";
import { cn } from "@/lib/utils";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { FarmMapCard } from "./farm-map-card";
import { FarmMapControllerDetail } from "./farm-map-controller-detail";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";

type Props = {
  barns: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
};

const GRAPH_PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

/**
 * lg 미만 — 데스크톱 그리드와 동일 정책(요약+히트맵 병합 카드, 이상 행 클릭 시 인라인 상세)을
 * 모바일 세로 단일 컬럼으로 적용. 레거시 드릴 그래프(FarmMapGraphStage) 미사용.
 */
export function FarmMapMobileStage({
  barns,
  trendByPeriod,
  controllerTrendByPeriod,
  controller,
  hubMode = false,
}: Props) {
  const router = useRouter();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [graphPeriod, setGraphPeriod] = useState<TrendPeriodId>("24h");

  const bulkEnabled = Boolean(controller?.canCommand);
  const graphMode = Boolean(trendByPeriod) && !bulkMode;

  const barnsRef = useRef(barns);
  useEffect(() => {
    barnsRef.current = barns;
  }, [barns]);

  const { expanded, setExpanded, graphByBarnId, metricIdsByBarnId, detail } =
    useBarnGraphs({
      barns,
      trendByPeriod,
      controllerTrendByPeriod,
      controller,
      graphPeriod,
      enabled: graphMode,
    });

  // 스포트라이트 투어 — 확대 상세 열기/닫기(FarmMapCanvas와 동일).
  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent).detail?.action as string | undefined;
      if (action === "collapse") {
        setExpanded(null);
        return;
      }
      if (action === "expand-first") {
        const first = barnsRef.current.find(
          (b) => (metricIdsByBarnId.get(b.meta.id)?.length ?? 0) > 0,
        );
        const ids = first ? metricIdsByBarnId.get(first.meta.id) : undefined;
        if (first && ids?.[0]) {
          setExpanded({ barnId: first.meta.id, metricId: ids[0] });
        }
      }
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () => window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, [metricIdsByBarnId, setExpanded]);

  const toggleSp = useCallback((sp: string) => {
    setSelectedSps((prev) => {
      const next = new Set(prev);
      if (next.has(sp)) next.delete(sp);
      else next.add(sp);
      return next;
    });
  }, []);

  const exitBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedSps(new Set());
  }, []);

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-md border"
      data-audit-region="farm-map-mobile-list"
    >
      {bulkEnabled && controller ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={() => setBulkMode(true)}
          onClearSelection={() => setSelectedSps(new Set())}
          onExit={exitBulk}
          onAfterApply={() => {
            if (!hubMode) router.refresh();
          }}
        />
      ) : null}

      {graphMode && barns.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div
            className="inline-flex overflow-hidden rounded-md border bg-background text-xs"
            role="group"
            aria-label="기간"
            data-tour-id="period-select"
          >
            {GRAPH_PERIOD_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGraphPeriod(p)}
                className={cn(
                  "px-2.5 py-1 font-medium transition-colors",
                  graphPeriod === p
                    ? "bg-sky-50 text-sky-700"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {TREND_PERIODS[p].label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 p-2">
        {barns.map((b) => {
          const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
          const isExpanded = expanded?.barnId === b.meta.id;
          return (
            <div
              key={b.meta.id}
              className={cn(
                "flex min-w-0 flex-col transition-all duration-200",
                isExpanded && "rounded-lg ring-2 ring-sky-500/50 ring-offset-1",
              )}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                graphContent={
                  graphMode ? graphByBarnId.get(b.meta.id) : undefined
                }
                selectable={bulkMode && Boolean(spCode)}
                selected={bulkMode && selectedSps.has(spCode)}
                onSelect={
                  bulkMode
                    ? spCode
                      ? () => toggleSp(spCode)
                      : undefined
                    : undefined
                }
              />
              {graphMode && detail && isExpanded ? (
                <FarmMapControllerDetail
                  key={detail.barnId}
                  label={detail.label}
                  metricId={expanded.metricId}
                  controllers={detail.controllers}
                  period={graphPeriod}
                  bars={GRAPH_BARS[graphPeriod]}
                  readings={controller?.readings ?? []}
                  thermoSettings={controller?.thermoSettings ?? {}}
                  commands={controller?.commands ?? []}
                  canCommand={Boolean(controller?.canCommand)}
                  alarmSettings={controller?.alarmSettings}
                  controllerTrendByPeriod={controllerTrendByPeriod}
                  onChangeMetric={(metricId) =>
                    setExpanded((e) => (e ? { ...e, metricId } : e))
                  }
                  onClose={() => setExpanded(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
