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

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  auditRegion?: string;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "top-auto flex max-h-none flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl p-0 pb-[env(safe-area-inset-bottom,0px)]",
          "data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
          viewportCompact
            ? "bottom-auto left-1/2 h-full w-full -translate-x-1/2 translate-y-0"
            : "bottom-0 h-[85dvh] max-h-[85dvh] left-0 w-full max-w-none translate-x-0 translate-y-0 sm:max-w-none md:h-[min(85dvh,36rem)] md:max-h-[min(85dvh,36rem)]",
          className,
        )}
        data-mobile-viewport-sheet={viewportCompact || undefined}
        data-audit-region={auditRegion}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
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

/** @deprecated BarnPanelBottomSheet 사용 */
export function BarnSettingsBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BarnPanelBottomSheet
      open={open}
      onClose={onClose}
      title={title}
      className={className}
      contentClassName="overflow-y-auto"
      auditRegion="barn-settings-bottom-sheet"
    >
      {children}
    </BarnPanelBottomSheet>
  );
}
