"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { patchBarnGridsAction } from "@/app/(dashboard)/farm/actions";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { barnSnapshotHasLiveForSp } from "@/lib/data/barn-map";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { appendFarmKeyParams, type FarmKey } from "@/lib/data/farm-key";
import { getStallTypeName, normalizeStallTyCode } from "@/lib/data/stall-type";
import type {
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { FarmMapDrillLevel } from "@/lib/farm/farm-view-url";
import {
  clearMapControllerStall,
  clearMapDrillParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  setMapControllerStall,
  setMapDrillLevel,
  setMapGraphSp,
} from "@/lib/farm/farm-view-url";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapCard } from "./farm-map-card";
import { FarmMapGraphStage, type FarmMapTrendStatus } from "./farm-map-graph-stage";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { cn } from "@/lib/utils";

type Props = {
  initialBarns: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  /** 전체 3기간(24h/7d/30d) 추이 시계열 — 그래프 모핑용. */
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  trendStatus?: FarmMapTrendStatus;
  onTrendRetry?: () => void;
  /** in-grid 컨트롤러 카드플립 구동용 데이터. */
  controller?: ControllerGridData | null;
  /** tree/alarm deep-link — 그래프·컨트롤러 in-grid 진입 */
  deepLinkSp?: string | null;
  deepLinkMapLevel?: FarmMapDrillLevel;
  deepLinkStallNo?: string | null;
  hubMode?: boolean;
  /** Admin 전체 보기 — 카드 클릭 시 해당 farm scoped URL로 이동 */
  navigateFarmKey?: FarmKey | null;
  /** Admin — farm 간 cols×rows 통일(데이터); 레이아웃은 Farmer와 동일 auto 행 */
  uniformGridLayout?: boolean;
};

const GRID_COL_MIN = "4.75rem";
const GRID_ROW_TRACK = "minmax(3.5rem, auto)";

function gridMinHeight(rows: number): string {
  if (rows <= 4) return "22rem";
  if (rows <= 6) return "28rem";
  return "34rem";
}

function moveBarn(
  barns: BarnMapSnapshot[],
  draggedId: string,
  toCol: number,
  toRow: number
): BarnMapSnapshot[] {
  const dragged = barns.find((b) => b.meta.id === draggedId);
  if (!dragged) return barns;
  if (dragged.meta.grid.col === toCol && dragged.meta.grid.row === toRow) {
    return barns;
  }

  const from = dragged.meta.grid;
  const occupant = barns.find(
    (b) =>
      b.meta.id !== draggedId &&
      b.meta.grid.col === toCol &&
      b.meta.grid.row === toRow
  );

  return barns.map((b) => {
    if (b.meta.id === draggedId) {
      return {
        ...b,
        meta: { ...b.meta, grid: { col: toCol, row: toRow } },
      };
    }
    if (occupant && b.meta.id === occupant.meta.id) {
      return {
        ...b,
        meta: { ...b.meta, grid: { col: from.col, row: from.row } },
      };
    }
    return b;
  });
}

function layoutPatch(
  prev: BarnMapSnapshot[],
  next: BarnMapSnapshot[]
): Record<string, { col: number; row: number }> {
  const patch: Record<string, { col: number; row: number }> = {};
  for (const b of next) {
    const old = prev.find((p) => p.meta.id === b.meta.id);
    if (!old) continue;
    if (
      old.meta.grid.col !== b.meta.grid.col ||
      old.meta.grid.row !== b.meta.grid.row
    ) {
      patch[b.meta.id] = { col: b.meta.grid.col, row: b.meta.grid.row };
    }
  }
  return patch;
}

function readCellFromPoint(clientX: number, clientY: number): { col: number; row: number } | null {
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest("[data-grid-cell]") as HTMLElement | null;
  if (!cell?.dataset.col || !cell?.dataset.row) return null;
  return {
    col: Number(cell.dataset.col),
    row: Number(cell.dataset.row),
  };
}

export function FarmMapCanvas({
  initialBarns,
  gridCols,
  gridRows,
  trendByPeriod,
  trendStatus = "ready",
  onTrendRetry,
  controller,
  deepLinkSp,
  deepLinkMapLevel = "sp",
  deepLinkStallNo,
  hubMode = false,
  navigateFarmKey = null,
  uniformGridLayout: _uniformGridLayout = false,
}: Props) {
  const router = useRouter();
  const isOverviewFarm = Boolean(navigateFarmKey);
  const urlSp = deepLinkSp ? normalizeStallTyCode(deepLinkSp) : null;
  const [activeSp, setActiveSp] = useState<string | null>(urlSp);
  /** 그리드→단일 stall 컨트롤러 직행 시 shallow URL보다 먼저 쓰는 로컬 드릴 */
  const [quickControllerStall, setQuickControllerStall] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setActiveSp(urlSp);
  }, [urlSp]);

  const [barns, setBarns] = useState(initialBarns);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphFromGridRef = useRef(false);
  const draggedIdRef = useRef<string | null>(null);
  const barnsRef = useRef(barns);
  barnsRef.current = barns;

  const bulkEnabled = Boolean(controller?.canCommand);

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

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /** Stagger fade+scale-in for grid cards (only when returning from a graph). */
  const animateCardEnter = useCallback(
    (node: HTMLDivElement | null, index: number) => {
      if (!node || !morphFromGridRef.current) return;
      if (prefersReducedMotion() || typeof node.animate !== "function") return;
      node.animate(
        [
          { opacity: 0, transform: "scale(0.96) translateY(10px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 300,
          delay: (index % 6) * 45,
          easing: "ease-out",
          fill: "backwards",
        }
      );
    },
    [prefersReducedMotion]
  );

  const openGraph = useCallback(
    (stallTyCode: string) => {
      if (!stallTyCode) return;
      const sp = normalizeStallTyCode(stallTyCode);
      if (navigateFarmKey) {
        const params = new URLSearchParams();
        appendFarmKeyParams(params, navigateFarmKey);
        params.set("sp", sp);
        router.push(`/farm?${params.toString()}`);
        return;
      }
      setActiveSp(sp);
      const params = currentFarmSearchParams();
      setMapGraphSp(params, sp);

      // LIVE 컨트롤러가 1대뿐이면 바로 제어 패널
      const spReadings = (controller?.readings ?? []).filter(
        (r) => normalizeStallTyCode(r.stallTyCode) === sp,
      );
      if (spReadings.length === 1 && spReadings[0].stallNo) {
        setMapDrillLevel(params, "stalls");
        setMapControllerStall(params, spReadings[0].stallNo);
        setQuickControllerStall(spReadings[0].stallNo);
      } else {
        clearMapControllerStall(params);
        params.delete("ctrl");
        setQuickControllerStall(null);
      }
      replaceFarmUrlShallow(params);
    },
    [navigateFarmKey, router, controller?.readings],
  );

  const closeGraph = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    morphFromGridRef.current = true;
    setActiveSp(null);
    setQuickControllerStall(null);
    const params = currentFarmSearchParams();
    clearMapDrillParams(params);
    replaceFarmUrlShallow(params);
  }, []);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (activeSp) morphFromGridRef.current = false;
  }, [activeSp]);

  const minHeight = useMemo(() => gridMinHeight(gridRows), [gridRows]);

  const barnIdsKey = useMemo(
    () => initialBarns.map((b) => b.meta.id).sort().join("|"),
    [initialBarns]
  );
  const prevBarnIdsKeyRef = useRef(barnIdsKey);

  useEffect(() => {
    setBarns(initialBarns);
    // 축사 구성(농장/스코프)이 바뀐 경우에만 그리드로 리셋.
    // 값만 갱신되는 폴링·명령 후 refresh 시에는 열린 그래프/컨트롤러 뷰 유지.
    if (prevBarnIdsKeyRef.current !== barnIdsKey) {
      prevBarnIdsKeyRef.current = barnIdsKey;
      setActiveSp(null);
      const params = currentFarmSearchParams();
      if (params.get("sp") || params.get("stall") || params.get("mapLevel")) {
        clearMapDrillParams(params);
        replaceFarmUrlShallow(params);
      }
    }
  }, [initialBarns, barnIdsKey]);

  const persistPatch = useCallback(
    (prev: BarnMapSnapshot[], next: BarnMapSnapshot[]) => {
      const patch = layoutPatch(prev, next);
      if (Object.keys(patch).length === 0) return;

      setSaveError(null);
      setPendingSaves((n) => n + 1);
      void patchBarnGridsAction(patch)
        .then((result) => {
          if (!result.ok) {
            setBarns(prev);
            setSaveError("위치 저장에 실패했습니다.");
          }
        })
        .catch(() => {
          setBarns(prev);
          setSaveError("위치 저장에 실패했습니다.");
        })
        .finally(() => setPendingSaves((n) => Math.max(0, n - 1)));
    },
    []
  );

  const handleDrop = useCallback(
    (draggedIdValue: string, col: number, row: number) => {
      if (!draggedIdValue) return;
      const prev = barnsRef.current;
      const next = moveBarn(prev, draggedIdValue, col, row);
      if (next === prev) return;
      setBarns(next);
      persistPatch(prev, next);
    },
    [persistPatch]
  );

  const endDrag = useCallback(() => {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDropTarget(null);
    document.body.style.cursor = "";
  }, []);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggedIdRef.current = id;
    setDraggedId(id);
    document.body.style.cursor = "grabbing";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!draggedId) return;

    const onMove = (e: PointerEvent) => {
      const cell = readCellFromPoint(e.clientX, e.clientY);
      if (cell) {
        setDropTarget(`${cell.col}-${cell.row}`);
      }
    };

    const onUp = (e: PointerEvent) => {
      const id = draggedIdRef.current;
      if (id) {
        const cell = readCellFromPoint(e.clientX, e.clientY);
        if (cell) handleDrop(id, cell.col, cell.row);
      }
      endDrag();
      if (e.target instanceof HTMLElement && e.pointerId) {
        try {
          e.target.releasePointerCapture(e.pointerId);
        } catch {
          /* capture may already be released */
        }
      }
    };

    const onCancel = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [draggedId, handleDrop, endDrag]);

  const cells = Array.from({ length: gridRows }, (_, ri) =>
    Array.from({ length: gridCols }, (_, ci) => ({
      col: ci + 1,
      row: ri + 1,
    }))
  ).flat();

  const isDragging = draggedId !== null;

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
        className="relative rounded-md border"
        data-audit-desktop-only
        style={{ minHeight }}
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
          initialMapLevel={
            quickControllerStall ? "stalls" : deepLinkMapLevel
          }
          initialControllerStallNo={
            quickControllerStall ?? deepLinkStallNo ?? null
          }
          onClose={closeGraph}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-0 flex-col rounded-md border"
      data-audit-desktop-only
      style={{ minHeight }}
    >
      {bulkEnabled && controller && !isOverviewFarm ? (
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
      {pendingSaves > 0 && (
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
          <Loader2 className="size-3 animate-spin md:size-5" />
          위치 저장 중…
        </div>
      )}
      {saveError ? (
        <div className="absolute bottom-3 right-3 z-30 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive shadow">
          {saveError}
        </div>
      ) : null}
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-1.5 overflow-auto p-3",
          "bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)]",
          "bg-[size:20px_20px] bg-muted/10 dark:bg-muted/6",
          isDragging && "select-none"
        )}
        style={{
          minHeight,
          gridTemplateColumns: `repeat(${gridCols}, minmax(${GRID_COL_MIN}, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, ${GRID_ROW_TRACK})`,
        }}
      >
        {cells.map(({ col, row }) => {
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          return (
            <div
              key={`drop-${key}`}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "z-0 min-h-[3.25rem] rounded-md border border-transparent transition-colors",
                isTarget && "border-emerald-400 bg-emerald-50/60"
              )}
              style={{ gridColumn: col, gridRow: row }}
            />
          );
        })}

        {barns.map((b, i) => {
          const { col, row } = b.meta.grid;
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          const isThisDragging = draggedId === b.meta.id;
          const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
          return (
            <div
              key={b.meta.id}
              ref={(node) => animateCardEnter(node, i)}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "relative z-20 flex min-h-0 min-w-0 flex-col self-start transition-all duration-300 ease-out",
                isTarget && "rounded-lg ring-2 ring-emerald-400 ring-offset-1",
                isDragging && "pointer-events-none",
                isThisDragging && "z-30 opacity-60"
              )}
              style={{
                gridColumn: col,
                gridRow: row,
              }}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                compact
                draggable={!bulkMode}
                isDragging={isThisDragging}
                onGripPointerDown={startDrag}
                selectable={bulkMode && Boolean(spCode)}
                selected={bulkMode && selectedSps.has(spCode)}
                onSelect={
                  bulkMode
                    ? spCode
                      ? () => toggleSp(spCode)
                      : undefined
                    : spCode
                      ? () => openGraph(spCode)
                      : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
