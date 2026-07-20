"use client";

import { useEffect, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";

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

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
        data-mobile-viewport-sheet={viewportCompact || undefined}
        data-audit-region={auditRegion}
      >
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
