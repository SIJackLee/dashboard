"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { dashboardElevation, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";

const COLLAPSE_DRAG_PX = 48;
const EXPAND_DRAG_PX = 36;

/**
 * 모델 탭 하단 — 핸들 바텀시트. 허브 본문 아래에 붙는다.
 * collapsibleInner(min-height:0)는 flex 안에서 펼침 높이가 0이 되어 쓰지 않는다.
 * 접기/펼치기는 탭과 세로 스와이프(포인터) 모두.
 */
export function FarmPlanDockSheet({
  peekLabel,
  collapseLabel = "선택·도안 접기",
  expandLabel = "선택·도안 펼치기",
  children,
}: {
  peekLabel: string;
  collapseLabel?: string;
  expandLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const openRef = useRef(true);
  const startYRef = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const draggedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    pointerIdRef.current = null;
    setDragY(0);
    setDragging(false);
    startYRef.current = null;
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const applyDragY = useCallback((clientY: number) => {
    const start = startYRef.current;
    if (start == null) return;
    if (openRef.current) {
      const next = Math.max(0, clientY - start);
      if (next > 6) draggedRef.current = true;
      dragYRef.current = next;
      setDragY(next);
      return;
    }
    const next = Math.min(0, clientY - start);
    if (next < -6) draggedRef.current = true;
    dragYRef.current = next;
    setDragY(next);
  }, []);

  const finishDrag = useCallback(() => {
    if (startYRef.current == null) return;
    const dy = dragYRef.current;
    const wasOpen = openRef.current;
    resetDrag();
    if (wasOpen && dy >= COLLAPSE_DRAG_PX) {
      setOpen(false);
      return;
    }
    if (!wasOpen && -dy >= EXPAND_DRAG_PX) {
      setOpen(true);
    }
  }, [resetDrag]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (pointerIdRef.current == null || e.pointerId !== pointerIdRef.current) {
        return;
      }
      applyDragY(e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (pointerIdRef.current == null || e.pointerId !== pointerIdRef.current) {
        return;
      }
      finishDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyDragY, finishDrag]);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isPrimaryPress(e)) return;
      startYRef.current = e.clientY;
      dragYRef.current = 0;
      draggedRef.current = false;
      pointerIdRef.current = e.pointerId;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* WebView capture 실패 시 window 리스너가 이어 받음 */
      }
    },
    [],
  );

  return (
    <aside
      className={cn(
        dashboardElevation.overlay,
        "flex max-h-[min(48%,26rem)] w-full shrink-0 flex-col rounded-b-none rounded-t-xl pb-[env(safe-area-inset-bottom,0px)]",
      )}
      data-testid="farm-plan-dock"
      style={
        dragY !== 0
          ? {
              transform: `translateY(${dragY}px)`,
              transition: dragging ? "none" : undefined,
            }
          : undefined
      }
    >
      <button
        type="button"
        className={cn(
          "flex min-h-11 w-full shrink-0 cursor-grab touch-none flex-col items-center justify-center pt-2.5 pb-1.5 active:cursor-grabbing",
          motionClass.microInteractive,
        )}
        aria-label={open ? collapseLabel : expandLabel}
        aria-expanded={open}
        data-testid="farm-plan-sheet-handle"
        data-sheet-drag-handle
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          setOpen((on) => !on);
        }}
        onPointerDown={onHandlePointerDown}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          applyDragY(e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          finishDrag();
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          finishDrag();
        }}
      >
        <span
          className="h-1.5 w-12 rounded-full bg-muted-foreground/40"
          aria-hidden
        />
        {!open ? (
          <span className={cn(dashboardTypography.meta, "mt-1.5 max-w-[90%] truncate")}>
            {peekLabel}
          </span>
        ) : null}
      </button>
      <div
        className={cn("grid", motionClass.transitionLayout)}
        data-open={open ? "true" : undefined}
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden" aria-hidden={!open}>
          <div className="min-h-min overflow-y-auto px-3 pb-3">{children}</div>
        </div>
      </div>
    </aside>
  );
}
