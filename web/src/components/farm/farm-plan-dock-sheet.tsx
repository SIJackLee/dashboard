"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { dashboardElevation, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const COLLAPSE_DRAG_PX = 48;
const EXPAND_DRAG_PX = 36;

/**
 * 모델 탭 하단 — 핸들 바텀시트. 허브 본문 아래에 붙는다.
 * collapsibleInner(min-height:0)는 flex 안에서 펼침 높이가 0이 되어 쓰지 않는다.
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
  const startYRef = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const resetDrag = useCallback(() => {
    setDragY(0);
    setDragging(false);
    startYRef.current = null;
  }, []);

  const onHandleTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startYRef.current = t.clientY;
    draggedRef.current = false;
    setDragging(true);
  }, []);

  const onHandleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      const start = startYRef.current;
      const t = e.touches[0];
      if (start == null || !t) return;
      if (open) {
        const next = Math.max(0, t.clientY - start);
        if (next > 6) draggedRef.current = true;
        setDragY(next);
      } else {
        const next = Math.min(0, t.clientY - start);
        if (next < -6) draggedRef.current = true;
        setDragY(next);
      }
    },
    [open],
  );

  const onHandleTouchEnd = useCallback(() => {
    const dy = dragY;
    resetDrag();
    if (open && dy >= COLLAPSE_DRAG_PX) {
      setOpen(false);
      return;
    }
    if (!open && -dy >= EXPAND_DRAG_PX) {
      setOpen(true);
    }
  }, [dragY, open, resetDrag]);

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
              transform: `translateY(${Math.max(0, dragY)}px)`,
              transition: dragging ? "none" : undefined,
            }
          : undefined
      }
    >
      <button
        type="button"
        className={cn(
          "flex w-full shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1.5 active:cursor-grabbing",
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
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onTouchCancel={onHandleTouchEnd}
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
