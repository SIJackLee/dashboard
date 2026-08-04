"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { FarmAriaView } from "@/components/farm/farm-aria-view";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import type { FarmKey } from "@/lib/data/farm-key";
import { DELIN_NAME, DELIN_NAME_KO } from "@/lib/aria/aria-mode";
import { delinEnabled } from "@/lib/aria/delin-enabled";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const STORAGE_KEY_PC = "delin-chart-companion-open-v1";

type Props = {
  currentFarm: FarmKey | null;
  /** 차트 탭이 활성일 때만 */
  panelLiveActive: boolean;
  /**
   * true — 모바일 바텀시트 (U4)
   * false — PC 우측 드로어 (U3)
   */
  mobileSheet?: boolean;
  className?: string;
};

/**
 * 차트 위 DELIN companion.
 * PC: 우측 드로어 · 모바일: 바텀시트 + FAB.
 */
export function DelinChartCompanion({
  currentFarm,
  panelLiveActive,
  mobileSheet = false,
  className,
}: Props) {
  if (!delinEnabled()) return null;

  return (
    <DelinChartCompanionInner
      currentFarm={currentFarm}
      panelLiveActive={panelLiveActive}
      mobileSheet={mobileSheet}
      className={className}
    />
  );
}

function DelinChartCompanionInner({
  currentFarm,
  panelLiveActive,
  mobileSheet = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (mobileSheet) {
      setHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PC);
      if (raw === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [mobileSheet]);

  const setOpenPersist = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (mobileSheet) return;
      try {
        window.localStorage.setItem(STORAGE_KEY_PC, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [mobileSheet],
  );

  if (!currentFarm || !hydrated) return null;

  const fab = (
    <button
      type="button"
      className={cn(
        "pointer-events-auto inline-flex items-center gap-2 rounded-full",
        "border border-primary/30 bg-card/95 px-3.5 py-2.5 text-sm font-medium text-primary",
        "shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
        "hover:border-primary/50 hover:bg-primary/5",
        motionClass.microInteractive,
      )}
      aria-expanded={open}
      aria-controls={
        mobileSheet ? "delin-mobile-sheet" : "delin-chart-companion-panel"
      }
      onClick={() => setOpenPersist(true)}
      data-testid="delin-companion-open"
    >
      <Bot className="size-4" aria-hidden />
      {DELIN_NAME}
    </button>
  );

  if (mobileSheet) {
    return (
      <>
        {!open ? (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[4.75rem] right-3 z-20 lg:hidden",
              className,
            )}
            data-testid="delin-mobile-fab-root"
          >
            {fab}
          </div>
        ) : null}
        <BarnPanelBottomSheet
          open={open}
          onClose={() => setOpenPersist(false)}
          title={
            <span className="text-primary">
              {DELIN_NAME}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {DELIN_NAME_KO}
              </span>
            </span>
          }
          auditRegion="delin-mobile-sheet"
          contentClassName="overflow-y-auto"
        >
          <div id="delin-mobile-sheet" className="min-h-0 flex-1 pb-2">
            <FarmAriaView
              currentFarm={currentFarm}
              isMobileStack
              panelLiveActive={panelLiveActive && open}
              variant="companion"
              onChartHandoffComplete={() => setOpenPersist(false)}
            />
          </div>
        </BarnPanelBottomSheet>
      </>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 hidden lg:block",
        className,
      )}
      data-testid="delin-chart-companion-root"
    >
      {!open ? (
        <div className="absolute bottom-3 right-3">{fab}</div>
      ) : (
        <>
          <button
            type="button"
            className={cn(
              "pointer-events-auto absolute inset-0 border-0",
              "bg-background/15 dark:bg-black/15",
              motionClass.enterFade,
            )}
            aria-label="델린 닫기"
            onClick={() => setOpenPersist(false)}
            data-testid="delin-companion-dim"
          />
          <aside
            id="delin-chart-companion-panel"
            className={cn(
              "pointer-events-auto absolute inset-y-2 right-2 z-[1] flex w-[min(100%,22rem)] flex-col",
              "overflow-hidden rounded-xl border border-primary/30 bg-card/95",
              "shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
              motionClass.enterFade,
            )}
            aria-label={`${DELIN_NAME_KO} companion`}
            data-testid="delin-chart-companion"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <p className="text-xs font-semibold tracking-tight text-primary">
                {DELIN_NAME}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {DELIN_NAME_KO}
                </span>
              </p>
              <button
                type="button"
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md",
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-label="델린 닫기"
                onClick={() => setOpenPersist(false)}
                data-testid="delin-companion-close"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FarmAriaView
                currentFarm={currentFarm}
                panelLiveActive={panelLiveActive}
                variant="companion"
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
