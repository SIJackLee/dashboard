"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import {
  DEFAULT_TREND_PERIOD,
  type TrendControllerPeriodData,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";
import { GRAPH_BARS, barnIdForReading, useBarnGraphs } from "@/lib/farm/use-barn-graphs";
import { cn } from "@/lib/utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { FarmMapCard } from "./farm-map-card";
import { FarmMapControllerDetail } from "./farm-map-controller-detail";
import { BarnListToolbarMobileSheet } from "./barn-list-toolbar-mobile-sheet";
import { TrendPeriodToggle } from "./trend-period-toggle";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { useFarmTourGridAction } from "@/lib/onboarding/use-farm-tour-grid-action";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";

type Props = {
  barns: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
};

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
  trendPeriod: trendPeriodProp,
  onTrendPeriodChange,
  trendLoading = false,
  trendStale = false,
}: Props) {
  const router = useRouter();
  const liveRefresh = useFarmLiveRefreshOptional();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [localGraphPeriod, setLocalGraphPeriod] =
    useState<TrendPeriodId>(DEFAULT_TREND_PERIOD);
  const graphPeriod = trendPeriodProp ?? localGraphPeriod;
  const setGraphPeriod = onTrendPeriodChange ?? setLocalGraphPeriod;
  const [statusToast, setStatusToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);

  const bulkEnabled = Boolean(controller?.canCommand);
  const graphMode = Boolean(trendByPeriod) && !bulkMode;

  const { expanded, setExpanded, graphByBarnId, metricIdsByBarnId, detail } =
    useBarnGraphs({
      barns,
      trendByPeriod,
      controllerTrendByPeriod,
      controller,
      graphPeriod,
      enabled: graphMode,
    });
  const [detailSelectedReadingKey, setDetailSelectedReadingKey] = useState<
    string | null
  >(null);
  const [hostedSheetOpen, setHostedSheetOpen] = useState(false);
  const [hostedSheetPage, setHostedSheetPage] =
    useState<ControllerMobileSheetPage>(0);
  /** sheet 설정 페이지 그래프 — 카드별 기간 오버라이드 (미전달 시 토글 no-op 버그) */
  const [panelPeriodOverrides, setPanelPeriodOverrides] = useState<
    Record<string, TrendPeriodId>
  >({});
  const handlePanelPeriodChange = useCallback(
    (key: string, period: TrendPeriodId) => {
      setPanelPeriodOverrides((prev) => ({ ...prev, [key]: period }));
    },
    [],
  );

  const handleDetailClose = useCallback(() => {
    setExpanded(null);
    setDetailSelectedReadingKey(null);
    setHostedSheetOpen(false);
  }, [setExpanded]);

  const handlePickerNavigateReading = useCallback(
    (readingKey: string) => {
      const allReadings = controller?.readings ?? [];
      const reading = allReadings.find((r) => r.key === readingKey);
      if (!reading || !expanded) return;
      const targetBarnId = barnIdForReading(barns, reading);
      if (!targetBarnId) return;
      setDetailSelectedReadingKey(readingKey);
      if (targetBarnId !== expanded.barnId) {
        setExpanded((e) => (e ? { ...e, barnId: targetBarnId } : e));
      }
    },
    [barns, controller?.readings, expanded, setExpanded],
  );

  const handleHostedSheetSelectKey = useCallback(
    (readingKey: string) => {
      const allReadings = controller?.readings ?? [];
      const reading = allReadings.find((r) => r.key === readingKey);
      if (!reading || !expanded) {
        setDetailSelectedReadingKey(readingKey);
        return;
      }
      const targetBarnId = barnIdForReading(barns, reading);
      setDetailSelectedReadingKey(readingKey);
      if (targetBarnId && targetBarnId !== expanded.barnId) {
        setExpanded((e) => (e ? { ...e, barnId: targetBarnId } : e));
      }
    },
    [barns, controller?.readings, expanded, setExpanded],
  );

  useFarmTourGridAction({ barns, metricIdsByBarnId, setExpanded });

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
          onAfterApply={(_result, feedback) => {
            setStatusToast({ message: feedback.message, tone: feedback.tone });
            if (liveRefresh) {
              void liveRefresh.revalidateFarmLive();
            } else if (!hubMode) {
              router.refresh();
            }
          }}
          onRefreshLive={() => {
            if (liveRefresh) {
              void liveRefresh.revalidateFarmLive();
            } else if (!hubMode) {
              router.refresh();
            }
          }}
          trailing={
            graphMode && barns.length > 0 ? (
              <TrendPeriodToggle
                value={graphPeriod}
                onChange={setGraphPeriod}
                density="map"
                tourTarget
              />
            ) : undefined
          }
        />
      ) : null}

      {!bulkEnabled && graphMode && barns.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <TrendPeriodToggle
            value={graphPeriod}
            onChange={setGraphPeriod}
            density="map"
            tourTarget
          />
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
                compact
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
                  onPeriodChange={setGraphPeriod}
                  trendLoading={trendLoading}
                  trendStale={trendStale}
                  onChangeMetric={(metricId) =>
                    setExpanded((e) => (e ? { ...e, metricId } : e))
                  }
                  onClose={handleDetailClose}
                  selectedReadingKey={detailSelectedReadingKey}
                  onSelectedReadingKeyChange={setDetailSelectedReadingKey}
                  onPickerNavigateReading={handlePickerNavigateReading}
                  hostedMobileSheetOpen={hostedSheetOpen}
                  hostedMobileSheetPage={hostedSheetPage}
                  onHostedMobileSheetOpenChange={setHostedSheetOpen}
                  onHostedMobileSheetPageChange={setHostedSheetPage}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Detail remount와 무관하게 sheet 유지 — 축사유형 전환 시 닫힘/재오픈 방지 */}
      <BarnListToolbarMobileSheet
        open={hostedSheetOpen}
        readings={controller?.readings ?? []}
        selectedKey={detailSelectedReadingKey}
        sheetPage={hostedSheetPage}
        onSelectKey={handleHostedSheetSelectKey}
        onPageSettled={setHostedSheetPage}
        onClose={() => setHostedSheetOpen(false)}
        thermoSettings={controller?.thermoSettings ?? {}}
        commands={controller?.commands}
        alarmSettings={controller?.alarmSettings}
        canCommand={Boolean(controller?.canCommand)}
        controllerTrendByPeriod={controllerTrendByPeriod}
        trendLoading={trendLoading}
        trendStale={trendStale}
        bulkPeriod={graphPeriod}
        panelPeriodOverrides={panelPeriodOverrides}
        onPanelPeriodChange={handlePanelPeriodChange}
        showPickerAffiliation
      />
      <InlineStatusToast
        message={statusToast?.message ?? null}
        tone={statusToast?.tone}
        onDismiss={() => setStatusToast(null)}
      />
    </div>
  );
}
