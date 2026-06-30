"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { patchBarnGridsAction } from "@/app/(dashboard)/farm/actions";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { getStallTypeName } from "@/lib/data/stall-type";
import type {
  TrendPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "./farm-map-controller-panel";
import { FarmMapLegend } from "./farm-map-legend";
import { FarmMapCard } from "./farm-map-card";
import { FarmMapGraphStage } from "./farm-map-graph-stage";
import { cn } from "@/lib/utils";

type Props = {
  initialBarns: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  /** 전체 3기간(24h/7d/30d) 추이 시계열 — 그래프 모핑용. */
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  /** in-grid 컨트롤러 카드플립 구동용 데이터. */
  controller?: ControllerGridData | null;
};

/** Grid → graph morph phases. */
type MorphPhase = "grid" | "leaving" | "graph";

const LEAVE_MS = 280;

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
  controller,
}: Props) {
  const [barns, setBarns] = useState(initialBarns);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedSp, setSelectedSp] = useState<string | null>(null);
  const [phase, setPhase] = useState<MorphPhase>("grid");
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True for the single grid render right after returning from a graph. */
  const gridEnterRef = useRef(false);
  const draggedIdRef = useRef<string | null>(null);
  const barnsRef = useRef(barns);
  barnsRef.current = barns;

  const trendEnabled = Boolean(trendByPeriod);

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /** Stagger fade+scale-in for grid cards (only when returning from a graph). */
  const animateCardEnter = useCallback(
    (node: HTMLDivElement | null, index: number) => {
      if (!node || !gridEnterRef.current) return;
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
      if (!trendEnabled || !stallTyCode) return;
      setSelectedSp(stallTyCode);
      if (prefersReducedMotion()) {
        setPhase("graph");
        return;
      }
      setPhase("leaving");
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = setTimeout(() => setPhase("graph"), LEAVE_MS);
    },
    [trendEnabled, prefersReducedMotion]
  );

  const closeGraph = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    gridEnterRef.current = true;
    setSelectedSp(null);
    setPhase("grid");
  }, []);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  /** Disable the one-shot enter flag after the grid commit consumes it. */
  useEffect(() => {
    if (phase === "grid") gridEnterRef.current = false;
  }, [phase]);

  const minHeight = useMemo(() => {
    if (gridRows <= 4) return "22rem";
    if (gridRows <= 6) return "28rem";
    return "34rem";
  }, [gridRows]);

  useEffect(() => {
    setBarns(initialBarns);
    setSelectedSp(null);
    setPhase("grid");
  }, [initialBarns]);

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

  if (phase === "graph" && selectedSp) {
    const farmKey =
      barns
        .map((b) => parseBarnCatalogKey(b.meta.id))
        .find((c) => c?.stallTyCode === selectedSp)?.farmKey ?? null;
    const controllerHref = farmKey
      ? buildControllerHref({ farmKey, sp: selectedSp })
      : null;
    return (
      <div
        className="relative hidden rounded-md border lg:block"
        data-audit-desktop-only
        style={{ minHeight }}
      >
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
      className="relative hidden rounded-md border lg:block"
      data-audit-desktop-only
      style={{ minHeight }}
    >
      <FarmMapLegend />
      {pendingSaves > 0 && (
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
          <Loader2 className="size-3 animate-spin" />
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
          "grid h-full gap-1.5 overflow-auto p-3",
          "bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)]",
          "bg-[size:20px_20px] bg-muted/15",
          isDragging && "select-none"
        )}
        style={{
          minHeight,
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, minmax(3.25rem, auto))`,
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
          const isLeaving = phase === "leaving" && spCode !== selectedSp;
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
                isThisDragging && "z-30 opacity-60",
                isLeaving && "pointer-events-none scale-95 opacity-0"
              )}
              style={{
                gridColumn: col,
                gridRow: row,
                transitionDelay: isLeaving ? `${(i % 6) * 40}ms` : undefined,
              }}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                compact
                draggable
                isDragging={isThisDragging}
                onGripPointerDown={startDrag}
                onSelect={
                  trendEnabled && spCode ? () => openGraph(spCode) : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
