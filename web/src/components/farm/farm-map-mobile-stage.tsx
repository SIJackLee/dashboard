"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { getStallTypeName } from "@/lib/data/stall-type";
import type {
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { FarmMapGraphStage } from "./farm-map-graph-stage";
import { FarmMapList } from "./farm-map-list";

type Props = {
  barns: BarnMapSnapshot[];
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
};

/** lg 미만 — 세로 목록 · 그래프 · in-grid 컨트롤러 (데스크톱 그리드와 동일 흐름) */
export function FarmMapMobileStage({
  barns,
  trendByPeriod,
  controller,
}: Props) {
  const [selectedSp, setSelectedSp] = useState<string | null>(null);
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
      setSelectedSp(null);
      setBulkMode(false);
      setSelectedSps(new Set());
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
    setSelectedSp(stallTyCode);
  }, []);

  const closeGraph = useCallback(() => {
    setSelectedSp(null);
  }, []);

  if (selectedSp) {
    const farmKey =
      barns
        .map((b) => parseBarnCatalogKey(b.meta.id))
        .find((c) => c?.stallTyCode === selectedSp)?.farmKey ?? null;
    const controllerHref = farmKey
      ? buildControllerHref({ farmKey, sp: selectedSp })
      : null;

    return (
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]" data-audit-region="farm-map-mobile-graph">
        <FarmMapGraphStage
          stallTyCode={selectedSp}
          label={getStallTypeName(selectedSp)}
          dataByPeriod={trendByPeriod ?? null}
          controllerHref={controllerHref}
          controller={controller ?? null}
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
