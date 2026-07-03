"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { barnSnapshotHasLiveForSp } from "@/lib/data/barn-map";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { getStallTypeName, normalizeStallTyCode } from "@/lib/data/stall-type";
import type {
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { FarmMapDrillLevel } from "@/lib/farm/farm-view-url";
import {
  clearMapDrillParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  setMapGraphSp,
} from "@/lib/farm/farm-view-url";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { FarmMapGraphStage, type FarmMapTrendStatus } from "./farm-map-graph-stage";
import { FarmMapList } from "./farm-map-list";

type Props = {
  barns: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  trendStatus?: FarmMapTrendStatus;
  onTrendRetry?: () => void;
  controller?: ControllerGridData | null;
  deepLinkSp?: string | null;
  deepLinkMapLevel?: FarmMapDrillLevel;
  deepLinkStallNo?: string | null;
  hubMode?: boolean;
};

/** lg 미만 — 세로 목록 · 그래프 · in-grid 컨트롤러 (데스크톱 그리드와 동일 흐름) */
export function FarmMapMobileStage({
  barns,
  trendByPeriod,
  trendStatus = "ready",
  onTrendRetry,
  controller,
  deepLinkSp,
  deepLinkMapLevel = "sp",
  deepLinkStallNo,
  hubMode = false,
}: Props) {
  const router = useRouter();
  const urlSp = deepLinkSp ? normalizeStallTyCode(deepLinkSp) : null;
  const [activeSp, setActiveSp] = useState<string | null>(urlSp);

  useEffect(() => {
    setActiveSp(urlSp);
  }, [urlSp]);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());

  const bulkEnabled = Boolean(controller?.canCommand);

  const barnIdsKey = useMemo(
    () => barns.map((b) => b.meta.id).sort().join("|"),
    [barns]
  );
  const prevBarnIdsKeyRef = useRef(barnIdsKey);

  useEffect(() => {
    if (prevBarnIdsKeyRef.current !== barnIdsKey) {
      prevBarnIdsKeyRef.current = barnIdsKey;
      setBulkMode(false);
      setSelectedSps(new Set());
      setActiveSp(null);
      const params = currentFarmSearchParams();
      if (params.get("sp") || params.get("stall") || params.get("mapLevel")) {
        clearMapDrillParams(params);
        replaceFarmUrlShallow(params);
      }
    }
  }, [barnIdsKey]);

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

  const openGraph = useCallback((stallTyCode: string) => {
    if (!stallTyCode) return;
    const sp = normalizeStallTyCode(stallTyCode);
    setActiveSp(sp);
    const params = currentFarmSearchParams();
    setMapGraphSp(params, sp);
    replaceFarmUrlShallow(params);
  }, []);

  const closeGraph = useCallback(() => {
    setActiveSp(null);
    const params = currentFarmSearchParams();
    clearMapDrillParams(params);
    replaceFarmUrlShallow(params);
  }, []);

  if (activeSp) {
    const farmKey =
      barns
        .map((b) => parseBarnCatalogKey(b.meta.id))
        .find((c) => c?.stallTyCode === activeSp)?.farmKey ?? null;
    const controllerHref = farmKey
      ? buildControllerHref({ farmKey, sp: activeSp })
      : null;

    return (
      <div
        className="pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        data-audit-region="farm-map-mobile-graph"
      >
        <FarmMapGraphStage
          stallTyCode={activeSp}
          label={getStallTypeName(activeSp)}
          dataByPeriod={trendByPeriod ?? null}
          trendStatus={trendStatus}
          hasLiveSnapshot={barnSnapshotHasLiveForSp(barns, activeSp)}
          onTrendRetry={onTrendRetry}
          controllerHref={controllerHref}
          controller={controller ?? null}
          initialMapLevel={deepLinkMapLevel}
          initialControllerStallNo={deepLinkStallNo ?? null}
          onClose={closeGraph}
        />
      </div>
    );
  }

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
      <FarmMapList
        barns={barns}
        bulkMode={bulkMode}
        selectedSps={selectedSps}
        onToggleSp={toggleSp}
        onOpenGraph={openGraph}
      />
    </div>
  );
}
