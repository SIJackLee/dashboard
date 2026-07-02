"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchFarmTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { FarmMapView } from "@/components/farm/farm-map-view";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { ControllerReading } from "@/lib/data/iot";
import {
  buildAutoBarnMap,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import {
  filterLayoutPrefsForFarm,
  type HubBarnLayoutPrefs,
} from "@/lib/monitoring/hub-view-state";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  farmId: string;
  readings: ControllerReading[];
  layoutPrefs: HubBarnLayoutPrefs;
  controller: ControllerGridData;
  /** 모바일 top — 바깥 제목 생략 */
  embedded?: boolean;
  /** tree/alarm deep-link — in-grid graph/controller 진입 */
  deepLinkSp?: string | null;
  deepLinkStallNo?: string | null;
};

/** Admin 전국 허브 — 선택 농장 farmer형 4×4 그리드 (in-grid graph/controller) */
export function AdminHubFarmMapPanel({
  farmId,
  readings,
  layoutPrefs,
  controller,
  embedded = false,
  deepLinkSp,
  deepLinkStallNo,
}: Props) {
  const scopedReadings = useMemo(
    () => readings.filter((r) => farmKeyId(r.farmKey) === farmId),
    [readings, farmId]
  );

  const farmKey = scopedReadings[0]?.farmKey ?? null;

  const [trendByPeriod, setTrendByPeriod] = useState<Record<
    TrendPeriodId,
    TrendPeriodData
  > | null>(null);

  useEffect(() => {
    if (!farmKey) {
      setTrendByPeriod(null);
      return;
    }
    let cancelled = false;
    void fetchFarmTrendAllPeriodsAction(farmKey).then((data) => {
      if (!cancelled) setTrendByPeriod(data);
    });
    return () => {
      cancelled = true;
    };
  }, [farmKey, farmId]);

  const { barnSnapshots, gridCols, gridRows, farmLabel } = useMemo(() => {
    const prefs = filterLayoutPrefsForFarm(layoutPrefs, farmId);
    const barnLayoutPrefs = {
      layouts: prefs.layouts,
      aliases: prefs.aliases,
      legacyBarns: [],
    };
    const { snapshots } = buildAutoBarnMap(scopedReadings, barnLayoutPrefs);
    const { cols, rows } = gridDimensionsForBarnMap(
      snapshots,
      prefs.layouts
    );
    const hit = scopedReadings[0]?.farmKey;
    return {
      barnSnapshots: snapshots,
      gridCols: cols,
      gridRows: rows,
      farmLabel: hit ? farmShortLabel(hit) : farmId,
    };
  }, [scopedReadings, layoutPrefs, farmId]);

  const scopedController = useMemo(
    (): ControllerGridData => ({
      ...controller,
      readings: scopedReadings,
    }),
    [controller, scopedReadings]
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        embedded ? "h-full" : "min-h-0 flex-1"
      )}
      data-audit-region={
        embedded ? "admin-hub-farm-map-mobile" : "admin-hub-farm-map"
      }
    >
      {!embedded ? (
        <p
          className={cn(
            "mb-2 shrink-0 truncate px-0.5 font-semibold text-foreground",
            dashboardUi.tableMeta
          )}
        >
          {farmLabel} · 농장 지도
        </p>
      ) : null}
      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          embedded ? "flex-1" : "flex-1"
        )}
      >
        <FarmMapView
          barns={barnSnapshots}
          gridCols={gridCols}
          gridRows={gridRows}
          trendByPeriod={trendByPeriod}
          controller={scopedController}
          deepLinkSp={deepLinkSp}
          deepLinkStallNo={deepLinkStallNo}
        />
      </div>
    </div>
  );
}
