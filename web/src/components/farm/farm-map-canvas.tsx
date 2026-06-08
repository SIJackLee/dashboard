"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import {
  GRID_COLS,
  GRID_ROWS,
  isGatewayCell,
} from "@/lib/data/barn-grid";
import { saveBarnGridsAction } from "@/app/(dashboard)/farm/actions";
import { FarmMapLegend } from "./farm-map-legend";
import { FarmMapGateway } from "./farm-map-gateway";
import { FarmMapCard } from "./farm-map-card";
import { cn } from "@/lib/utils";

type Props = {
  initialBarns: BarnMapSnapshot[];
  gatewayOnline: boolean;
  moduleCount: number;
};

function moveBarn(
  barns: BarnMapSnapshot[],
  draggedId: string,
  toCol: number,
  toRow: number
): BarnMapSnapshot[] {
  if (isGatewayCell(toCol, toRow)) return barns;

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
  gatewayOnline,
  moduleCount,
}: Props) {
  const router = useRouter();
  const [barns, setBarns] = useState(initialBarns);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draggedIdRef = useRef<string | null>(null);
  const barnsRef = useRef(barns);
  barnsRef.current = barns;

  useEffect(() => {
    setBarns(initialBarns);
  }, [initialBarns]);

  const persist = useCallback(
    (next: BarnMapSnapshot[]) => {
      setSaving(true);
      void saveBarnGridsAction(
        next.map((b) => ({
          id: b.meta.id,
          col: b.meta.grid.col,
          row: b.meta.grid.row,
        }))
      )
        .then(() => router.refresh())
        .finally(() => setSaving(false));
    },
    [router]
  );

  const handleDrop = useCallback(
    (draggedIdValue: string, col: number, row: number) => {
      if (!draggedIdValue || isGatewayCell(col, row)) return;
      const prev = barnsRef.current;
      const next = moveBarn(prev, draggedIdValue, col, row);
      if (next === prev) return;
      setBarns(next);
      persist(next);
    },
    [persist]
  );

  const endDrag = useCallback(() => {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDropTarget(null);
    document.body.style.cursor = "";
  }, []);

  const startDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (saving) return;
      e.preventDefault();
      e.stopPropagation();
      draggedIdRef.current = id;
      setDraggedId(id);
      document.body.style.cursor = "grabbing";
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [saving]
  );

  useEffect(() => {
    if (!draggedId) return;

    const onMove = (e: PointerEvent) => {
      const cell = readCellFromPoint(e.clientX, e.clientY);
      if (cell && !isGatewayCell(cell.col, cell.row)) {
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

  const cells = Array.from({ length: GRID_ROWS }, (_, ri) =>
    Array.from({ length: GRID_COLS }, (_, ci) => ({
      col: ci + 1,
      row: ri + 1,
    }))
  ).flat();

  const isDragging = draggedId !== null;

  return (
    <div className="relative hidden min-h-[28rem] rounded-md border md:block">
      <FarmMapLegend />
      {saving && (
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
          <Loader2 className="size-3 animate-spin" />
          위치 저장 중…
        </div>
      )}
      <p className="absolute bottom-3 right-3 z-30 text-[10px] text-muted-foreground">
        ⋮⋮ 핸들을 드래그해 축사 위치 변경
      </p>

      <div
        className={cn(
          "grid h-full min-h-[28rem] gap-2 p-3",
          "grid-cols-4 grid-rows-4",
          "bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)]",
          "bg-[size:20px_20px] bg-muted/15",
          isDragging && "select-none"
        )}
      >
        {cells.map(({ col, row }) => {
          const key = `${col}-${row}`;
          const isGw = isGatewayCell(col, row);
          const isTarget = dropTarget === key;
          return (
            <div
              key={`drop-${key}`}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "z-0 rounded-md border border-transparent transition-colors",
                isTarget && !isGw && "border-emerald-400 bg-emerald-50/60",
                isGw && "border-dashed border-muted-foreground/20 bg-muted/10"
              )}
              style={{ gridColumn: col, gridRow: row }}
            />
          );
        })}

        <FarmMapGateway online={gatewayOnline} moduleCount={moduleCount} />

        {barns.map((b) => {
          const { col, row } = b.meta.grid;
          const key = `${col}-${row}`;
          const isTarget = dropTarget === key;
          const isThisDragging = draggedId === b.meta.id;
          return (
            <div
              key={b.meta.id}
              data-grid-cell
              data-col={col}
              data-row={row}
              className={cn(
                "relative z-20 flex min-h-0 min-w-0 flex-col",
                isTarget && "ring-2 ring-emerald-400 ring-offset-1 rounded-lg",
                isDragging && "pointer-events-none",
                isThisDragging && "z-30 opacity-60"
              )}
              style={{ gridColumn: col, gridRow: row }}
            >
              <FarmMapCard
                snapshot={b}
                layout="stack"
                draggable
                isDragging={isThisDragging}
                onGripPointerDown={startDrag}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
