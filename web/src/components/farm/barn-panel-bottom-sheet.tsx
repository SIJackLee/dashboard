"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";

const DISMISS_DRAG_PX = 88;

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  auditRegion?: string;
  /** 있으면 헤더에「뒤로」— 시트 내 push 네비. */
  onBack?: () => void;
  backLabel?: string;
  /**
   * 컨트롤러 피커 등 — 본문 remount로 focus-out 시 닫히지 않게.
   * 운영 명령 상세 등에는 false(기본)로 두어 오버레이/ESC 닫기를 허용.
   */
  suppressFocusOutClose?: boolean;
};

/** 모바일 stack — bottom sheet shell (설정·컨트롤러 carousel 공용). */
export function BarnPanelBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  contentClassName,
  auditRegion = "barn-panel-bottom-sheet",
  onBack,
  backLabel = "뒤로",
  suppressFocusOutClose = false,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      startYRef.current = null;
    }
  }, [open]);

  const onHandleTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startYRef.current = t.clientY;
    setDragging(true);
  }, []);

  const onHandleTouchMove = useCallback((e: ReactTouchEvent) => {
    const start = startYRef.current;
    const t = e.touches[0];
    if (start == null || !t) return;
    const dy = Math.max(0, t.clientY - start);
    setDragY(dy);
  }, []);

  const onHandleTouchEnd = useCallback(() => {
    const dy = dragY;
    startYRef.current = null;
    setDragging(false);
    if (dy >= DISMISS_DRAG_PX) {
      setDragY(0);
      onClose();
      return;
    }
    setDragY(0);
  }, [dragY, onClose]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (next) return;
        if (suppressFocusOutClose && eventDetails.reason === "focus-out") {
          eventDetails.cancel();
          return;
        }
        onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "top-auto flex max-h-none flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl p-0 pb-[env(safe-area-inset-bottom,0px)]",
          motionClass.durationModerate,
          motionClass.sheetEnter,
          viewportCompact
            ? "bottom-auto left-1/2 h-full w-full -translate-x-1/2 translate-y-0"
            : "bottom-0 h-[85dvh] max-h-[85dvh] left-0 w-full max-w-none translate-x-0 translate-y-0 sm:max-w-none md:h-[min(85dvh,36rem)] md:max-h-[min(85dvh,36rem)]",
          className,
        )}
        style={
          dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                transition: dragging ? "none" : undefined,
              }
            : undefined
        }
        data-mobile-viewport-sheet={viewportCompact || undefined}
        data-audit-region={auditRegion}
      >
        {/* 핸들 — 아래로 끌어 닫기 (가로 페이지 스와이프와 축 분리) */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pt-2 active:cursor-grabbing"
          data-sheet-drag-handle
          aria-label="시트를 아래로 끌어 닫기"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
        >
          <span className="h-1 w-10 rounded-full bg-muted-foreground/35" aria-hidden />
        </div>
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center gap-2 pr-8">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                {backLabel}
              </button>
            ) : null}
            <DialogTitle className="min-w-0 flex-1 text-sm font-semibold">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            contentClassName,
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
