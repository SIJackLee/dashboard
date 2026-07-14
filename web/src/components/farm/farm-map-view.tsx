"use client";

import { useSyncExternalStore } from "react";
import { SectionCard } from "@/components/common/section-card";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import {
  farmGridEmptyCopy,
  resolveFarmGridEmptyReason,
} from "@/lib/data/farm-grid-empty";
import type { FarmKey } from "@/lib/data/farm-key";
import type {
  FarmMapTrendStatus,
  TrendControllerPeriodData,
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapCanvas } from "./farm-map-canvas";
import { FarmMapMobileStage } from "./farm-map-mobile-stage";
import { useDashboardCompact } from "@/components/layout/dashboard-viewport-context";

type Props = {
  barns: BarnMapSnapshot[];
  readings?: BarnReading[];
  gridCols?: number;
  gridRows?: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  onOpenListController?: (opts: {
    sp: string | null;
    stallNo: string | null;
    controllerKey: string;
  }) => void;
  trendStatus?: FarmMapTrendStatus;
  hubMode?: boolean;
  compactShell?: boolean;
  onTrendRetry?: () => void;
  controller?: ControllerGridData | null;
  sectionTitle?: string;
  navigateFarmKey?: FarmKey | null;
  uniformGridLayout?: boolean;
};

export function FarmMapView({
  barns,
  readings = [],
  gridCols = 4,
  gridRows = 4,
  trendByPeriod,
  controllerTrendByPeriod,
  onOpenListController,
  trendStatus = "ready",
  onTrendRetry,
  controller,
  hubMode = false,
  compactShell = false,
  sectionTitle,
  navigateFarmKey = null,
  uniformGridLayout = false,
}: Props) {
  const viewportCompact = useDashboardCompact();
  /** ResizeObserver 기반 compact — SSR/첫 hydration과 불일치 방지 */
  const showMobileListDesc = useSyncExternalStore(
    () => () => {},
    () => viewportCompact && !sectionTitle,
    () => false
  );
  const emptyReason =
    barns.length === 0 ? resolveFarmGridEmptyReason(readings) : null;
  const emptyCopy = emptyReason ? farmGridEmptyCopy(emptyReason) : null;

  return (
    <div className="min-w-0">
      <SectionCard
        title={sectionTitle ?? "농장 지도"}
        description={
          showMobileListDesc ? "축사별 현황 · 세로 목록" : undefined
        }
        size={compactShell ? "default" : "lg"}
        className="overflow-hidden"
      >
        {emptyCopy ? (
          <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center">
            <p
              className={
                compactShell
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-muted-foreground md:text-base"
              }
            >
              {emptyCopy.title}
            </p>
            <p className="text-xs text-muted-foreground">{emptyCopy.detail}</p>
          </div>
        ) : viewportCompact ? (
          <FarmMapMobileStage
            barns={barns}
            trendByPeriod={trendByPeriod}
            controllerTrendByPeriod={controllerTrendByPeriod}
            controller={controller}
            hubMode={hubMode}
          />
        ) : (
          <FarmMapCanvas
            initialBarns={barns}
            gridCols={gridCols}
            gridRows={gridRows}
            trendByPeriod={trendByPeriod}
            controllerTrendByPeriod={controllerTrendByPeriod}
            onOpenListController={onOpenListController}
            trendStatus={trendStatus}
            onTrendRetry={onTrendRetry}
            controller={controller}
            hubMode={hubMode}
            navigateFarmKey={navigateFarmKey}
            uniformGridLayout={uniformGridLayout}
          />
        )}
      </SectionCard>
    </div>
  );
}
