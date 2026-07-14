"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { patchBarnGridsAction } from "@/app/(dashboard)/farm/actions";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { type FarmKey } from "@/lib/data/farm-key";
import type {
  FarmMapTrendStatus,
  TrendControllerPeriodData,
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  clearMapDrillParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
} from "@/lib/farm/farm-view-url";
import { GRAPH_BARS, useBarnGraphs } from "@/lib/farm/use-barn-graphs";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapControllerDetail } from "./farm-map-controller-detail";
import { FarmMapCard } from "./farm-map-card";
import { FarmMapBulkApply } from "./farm-map-bulk-apply";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import { cn } from "@/lib/utils";

const GRAPH_PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

/** 히트맵 — 지표(행)·심각도 색 범례 */
function GraphModeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
      <span>행: 온도·습도·A·B·C</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-sm bg-emerald-500/60" />정상
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-sm bg-amber-500" />주의
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-sm bg-red-500" />경고
      </span>
    </div>
  );
}

type Props = {
  initialBarns: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  /** 전체 3기간(24h/7d/30d) 추이 시계열 — 그래프 모핑용. */
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  /** 컨트롤러 단위 3기간 시계열 — 히트맵 확대 시 컨트롤러별 미니 히트맵용(그리드 진입 프리페치). */
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  /** 히트맵 컨트롤러 '이동' — 목록 뷰로 클라이언트 전환(그리드 딥링크 스트립 회피). */
  onOpenListController?: (opts: {
    sp: string | null;
    stallNo: string | null;
    controllerKey: string;
  }) => void;
  /** @deprecated 레거시 그래프 제거 — 추이 로딩 상태(현재 미사용, 배선 호환용). */
  trendStatus?: FarmMapTrendStatus;
  /** @deprecated 레거시 그래프 제거 — 재시도 콜백(현재 미사용). */
  onTrendRetry?: () => void;
  /** in-grid 컨트롤러 카드플립 구동용 데이터. */
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  /** Admin 전체 보기 — 카드 클릭 시 해당 farm scoped URL로 이동 */
  navigateFarmKey?: FarmKey | null;
  /** Admin — farm 간 cols×rows 통일(데이터); 레이아웃은 Farmer와 동일 auto 행 */
  uniformGridLayout?: boolean;
};

const GRID_COL_MIN = "4.75rem";
const GRID_ROW_TRACK = "minmax(3.5rem, auto)";

function gridMinHeight(rows: number): string {
  if (rows <= 2) return "26rem";
  if (rows <= 4) return "34rem";
  if (rows <= 6) return "44rem";
  return "54rem";
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
  controllerTrendByPeriod,
  // onOpenListController · trendStatus · onTrendRetry: 레거시 그래프 제거로 미사용(배선 호환용).
  controller,
  hubMode = false,
  navigateFarmKey = null,
  uniformGridLayout: _uniformGridLayout = false,
}: Props) {
  const router = useRouter();
  const isOverviewFarm = Boolean(navigateFarmKey);
  const [barns, setBarns] = useState(initialBarns);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [graphPeriod, setGraphPeriod] = useState<TrendPeriodId>("24h");
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
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

  const minHeight = useMemo(() => gridMinHeight(gridRows), [gridRows]);

  /**
   * 근접 레이아웃 — 상세 확대 시 보드를 '사용 중인 행'까지만 축소해
   * 하단 전체폭 상세 패널이 소스 카드 바로 아래에 붙도록 한다.
   */
  const usedRows = useMemo(
    () => barns.reduce((m, b) => Math.max(m, b.meta.grid.row), 1),
    [barns],
  );

  const graphAvailable = Boolean(trendByPeriod);
  /** 병합 카드 — 추이 데이터가 있고 일괄모드가 아니면 요약+히트맵을 함께 표시. */
  const graphMode = graphAvailable && !bulkMode;
  /** 병합 카드는 요약(온·습도) + 히트맵이 들어가 요약 전용보다 큰 행 트랙 필요. */
  const rowTrack = graphMode ? "minmax(13rem, auto)" : GRID_ROW_TRACK;
  // 그리드/모바일 공용 — 히트맵 그래프 콘텐츠 + 확대 상세(데이터 없으면 히트맵 미표시).
  const { expanded, setExpanded, graphByBarnId, detail } = useBarnGraphs({
    barns,
    trendByPeriod,
    controllerTrendByPeriod,
    controller,
    graphPeriod,
    enabled: graphMode,
  });

  /** 상세 확대 중 — 보드를 '사용 중인 행'까지 축소해 상세 패널을 근접 배치. */
  const focusMode = graphMode && Boolean(expanded);
  const effRows = focusMode ? usedRows : gridRows;

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
      const params = currentFarmSearchParams();
      if (params.get("sp") || params.get("stall") || params.get("mapLevel")) {
        clearMapDrillParams(params);
        replaceFarmUrlShallow(params);
      }
      setExpanded(null);
    }
  }, [initialBarns, barnIdsKey, setExpanded]);

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

  const cells = Array.from({ length: effRows }, (_, ri) =>
    Array.from({ length: gridCols }, (_, ci) => ({
      col: ci + 1,
      row: ri + 1,
    }))
  ).flat();

  const isDragging = draggedId !== null;

  return (
    <div
      className="relative flex min-h-0 flex-col rounded-md border"
      data-audit-desktop-only
      style={{ minHeight: focusMode ? undefined : minHeight }}
    >
      {bulkEnabled && controller && !isOverviewFarm ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={() => {
            setBulkMode(true);
            setExpanded(null);
          }}
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
      {graphMode && barns.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div
            className="inline-flex overflow-hidden rounded-md border bg-background text-xs"
            role="group"
            aria-label="기간"
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
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {TREND_PERIODS[p].label}
              </button>
            ))}
          </div>
          <GraphModeLegend />
        </div>
      ) : null}
      <div
        className={cn(
          "grid min-h-0 gap-1.5 overflow-auto p-3",
          // 상세 확대 중에는 보드가 남은 높이를 채우지 않도록 flex-1 해제(근접 배치).
          focusMode ? "shrink-0" : "flex-1",
          "bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)]",
          "bg-[size:20px_20px] bg-muted/10 dark:bg-muted/6",
          isDragging && "select-none"
        )}
        style={{
          minHeight: focusMode ? undefined : minHeight,
          gridTemplateColumns: `repeat(${gridCols}, minmax(${GRID_COL_MIN}, 1fr))`,
          gridTemplateRows: `repeat(${effRows}, ${rowTrack})`,
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

        {barns.map((b) => {
          const { col, row } = b.meta.grid;
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          const isThisDragging = draggedId === b.meta.id;
          const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
          return (
            <div
              key={b.meta.id}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "relative z-20 flex min-h-0 min-w-0 flex-col self-start transition-all duration-300 ease-out",
                isTarget && "rounded-lg ring-2 ring-emerald-400 ring-offset-1",
                expanded?.barnId === b.meta.id &&
                  "rounded-lg ring-2 ring-sky-500/50 ring-offset-1",
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
            </div>
          );
        })}
      </div>
      {graphMode && detail && expanded ? (
        <FarmMapControllerDetail
          key={`${detail.barnId}`}
          label={detail.label}
          metricId={expanded.metricId}
          controllers={detail.controllers}
          gridCols={gridCols}
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
}
