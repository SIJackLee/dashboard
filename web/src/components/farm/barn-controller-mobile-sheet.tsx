"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BarnReading } from "@/lib/data/iot";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import { cn } from "@/lib/utils";

import type { ControllerMobileSheetPage } from "@/lib/farm/barn-list-panel-state";

export const CONTROLLER_MOBILE_SHEET_PAGES = [
  { id: 0 as const, label: "컨트롤러" },
  { id: 1 as const, label: "설정" },
] as const;

export function controllerMobileSheetPageFromFlags(
  settingsExpanded: boolean,
): ControllerMobileSheetPage {
  return settingsExpanded ? 1 : 0;
}

type Props = {
  open: boolean;
  initialPage: ControllerMobileSheetPage;
  onClose: () => void;
  /** 스와이프·segment 시 pill 상태 동기화 */
  onPageSettled?: (page: ControllerMobileSheetPage) => void;
  reading: BarnReading;
  controllerPage: ReactNode;
  settingsPage: ReactNode;
};

/** 모바일 stack — 컨트롤러(모터 추이) · 설정(온습 추이+설정) 2페이지 bottom sheet carousel. */
export function BarnControllerMobileSheet({
  open,
  initialPage,
  onClose,
  onPageSettled,
  reading,
  controllerPage,
  settingsPage,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewPage, setViewPage] = useState<ControllerMobileSheetPage>(initialPage);
  const settleTimerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setViewPage(initialPage);
    syncingRef.current = true;
    const id = window.requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) {
        el.scrollTo({ left: initialPage * el.clientWidth, behavior: "auto" });
      }
      syncingRef.current = false;
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, initialPage]);

  const scrollToPage = useCallback(
    (page: ControllerMobileSheetPage) => {
      const el = scrollerRef.current;
      if (!el) return;
      syncingRef.current = true;
      el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
      setViewPage(page);
      window.setTimeout(() => {
        syncingRef.current = false;
      }, 320);
      onPageSettled?.(page);
    },
    [onPageSettled],
  );

  const handleScroll = useCallback(() => {
    if (syncingRef.current) return;
    const el = scrollerRef.current;
    if (!el || el.clientWidth <= 0) return;

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      const next = Math.round(el.scrollLeft / el.clientWidth) as ControllerMobileSheetPage;
      const clamped = Math.min(1, Math.max(0, next)) as ControllerMobileSheetPage;
      setViewPage(clamped);
      onPageSettled?.(clamped);
    }, 80);
  }, [onPageSettled]);

  useEffect(
    () => () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  const eqpmn = formatControllerNoLabel(reading.eqpmnNo);
  const activeLabel =
    CONTROLLER_MOBILE_SHEET_PAGES.find((p) => p.id === viewPage)?.label ?? "";

  return (
    <BarnPanelBottomSheet
      open={open}
      onClose={onClose}
      title={`${eqpmn} · ${activeLabel}`}
      auditRegion="barn-controller-mobile-sheet"
      contentClassName="flex min-h-0 flex-col"
    >
      <div
        className="shrink-0 border-b px-3 py-2"
        data-tour-id="controller-mobile-sheet-tabs"
      >
        <div
          className="flex gap-1.5"
          role="tablist"
          aria-label="컨트롤러 상세 페이지"
        >
          {CONTROLLER_MOBILE_SHEET_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={viewPage === p.id}
              onClick={() => scrollToPage(p.id)}
              className={cn(
                "inline-flex min-h-8 flex-1 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors",
                viewPage === p.id
                  ? "border-sky-500 bg-sky-500/10 text-sky-800 dark:text-sky-300"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="barn-controller-mobile-sheet-scroller min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        onScroll={handleScroll}
      >
        <div className="barn-controller-mobile-sheet-track flex h-full min-h-0 w-[200%]">
          <section
            className="barn-controller-mobile-sheet-page flex h-full min-h-0 w-1/2 shrink-0 flex-col overflow-hidden"
            data-panel="controller"
            data-audit-region="controller-mobile-sheet-controller"
            aria-hidden={viewPage !== 0}
          >
            <div className="barn-controller-mobile-sheet-page-scroll min-h-0 flex-1 overflow-y-auto">
              {controllerPage}
            </div>
          </section>
          <section
            className="barn-controller-mobile-sheet-page flex h-full min-h-0 w-1/2 shrink-0 flex-col overflow-hidden"
            data-panel="settings"
            data-audit-region="controller-mobile-sheet-settings-panel"
            aria-hidden={viewPage !== 1}
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {settingsPage}
            </div>
          </section>
        </div>
      </div>
    </BarnPanelBottomSheet>
  );
}
