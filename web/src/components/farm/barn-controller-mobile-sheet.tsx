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
import { ControllerMobilePickerStrip } from "@/components/farm/controller-mobile-picker-strip";
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

const SETTLE_MS = 80;
const SYNC_GUARD_MS = 400;
const PAGE_SNAP_TOLERANCE = 0.12;

type Props = {
  open: boolean;
  initialPage: ControllerMobileSheetPage;
  onClose: () => void;
  /** 스와이프·segment 시 pill 상태 동기화 */
  onPageSettled?: (page: ControllerMobileSheetPage) => void;
  reading: BarnReading;
  controllerPage: ReactNode;
  settingsPage: ReactNode;
  /** 목록 Graph/Set — sheet 상단 컨트롤러 swipe picker */
  pickerReadings?: BarnReading[];
  selectedReadingKey?: string;
  onSelectReading?: (key: string) => void;
  showPickerAffiliation?: boolean;
};

function clampPage(raw: number): ControllerMobileSheetPage {
  return Math.min(1, Math.max(0, Math.round(raw))) as ControllerMobileSheetPage;
}

function pageFromScroll(el: HTMLDivElement): {
  page: ControllerMobileSheetPage;
  ratio: number;
} {
  const width = el.clientWidth;
  const ratio = width > 0 ? el.scrollLeft / width : 0;
  return { page: clampPage(ratio), ratio };
}

/** 모바일 stack — picker·탭·본문을 sheet 본문 전체에서 단일 세로 스크롤. */
export function BarnControllerMobileSheet({
  open,
  initialPage,
  onClose,
  onPageSettled,
  reading,
  controllerPage,
  settingsPage,
  pickerReadings,
  selectedReadingKey,
  onSelectReading,
  showPickerAffiliation = false,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewPage, setViewPage] = useState<ControllerMobileSheetPage>(initialPage);
  const settleTimerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const lastSettledRef = useRef<ControllerMobileSheetPage>(initialPage);
  const prevScrollLeftRef = useRef(0);
  const gradualScrollRef = useRef(false);
  const openSyncedRef = useRef(false);

  const beginSyncGuard = useCallback(() => {
    syncingRef.current = true;
    if (syncTimerRef.current != null) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncingRef.current = false;
      syncTimerRef.current = null;
      const el = scrollerRef.current;
      if (el) prevScrollLeftRef.current = el.scrollLeft;
    }, SYNC_GUARD_MS);
  }, []);

  const syncToPage = useCallback(
    (page: ControllerMobileSheetPage, behavior: ScrollBehavior = "auto") => {
      const el = scrollerRef.current;
      lastSettledRef.current = page;
      gradualScrollRef.current = false;
      setViewPage(page);
      if (!el) return;
      beginSyncGuard();
      window.requestAnimationFrame(() => {
        el.scrollTo({ left: page * el.clientWidth, behavior });
        prevScrollLeftRef.current = page * el.clientWidth;
      });
    },
    [beginSyncGuard],
  );

  useEffect(() => {
    if (!open) {
      openSyncedRef.current = false;
      return;
    }

    if (!openSyncedRef.current) {
      openSyncedRef.current = true;
      syncToPage(initialPage);
      return;
    }

    if (initialPage !== lastSettledRef.current) {
      syncToPage(initialPage);
    }
  }, [open, initialPage, syncToPage]);

  useEffect(
    () => () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
      if (syncTimerRef.current != null) {
        window.clearTimeout(syncTimerRef.current);
      }
    },
    [],
  );

  const scrollToPage = useCallback(
    (page: ControllerMobileSheetPage) => {
      syncToPage(page, "smooth");
      onPageSettled?.(page);
    },
    [onPageSettled, syncToPage],
  );

  const handleScroll = useCallback(() => {
    if (syncingRef.current) return;
    const el = scrollerRef.current;
    if (!el || el.clientWidth <= 0) return;

    const width = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    const prev = prevScrollLeftRef.current;
    const delta = Math.abs(scrollLeft - prev);

    if (delta > 2 && delta < width * 0.85) {
      gradualScrollRef.current = true;
    }

    if (delta >= width * 0.85) {
      gradualScrollRef.current = false;
      syncToPage(lastSettledRef.current, "auto");
      return;
    }

    prevScrollLeftRef.current = scrollLeft;

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      if (syncingRef.current) return;

      const { page, ratio } = pageFromScroll(el);
      if (Math.abs(ratio - page) > PAGE_SNAP_TOLERANCE) return;

      if (page !== lastSettledRef.current && !gradualScrollRef.current) {
        syncToPage(lastSettledRef.current, "auto");
        return;
      }

      gradualScrollRef.current = false;

      if (page === lastSettledRef.current) {
        setViewPage(page);
        return;
      }

      lastSettledRef.current = page;
      setViewPage(page);
      onPageSettled?.(page);
    }, SETTLE_MS);
  }, [onPageSettled, syncToPage]);

  const eqpmn = formatControllerNoLabel(reading.eqpmnNo);
  const activeLabel =
    CONTROLLER_MOBILE_SHEET_PAGES.find((p) => p.id === viewPage)?.label ?? "";

  const showPicker =
    pickerReadings &&
    pickerReadings.length > 0 &&
    selectedReadingKey &&
    onSelectReading;

  return (
    <BarnPanelBottomSheet
      open={open}
      onClose={onClose}
      title={`${eqpmn} · ${activeLabel}`}
      auditRegion="barn-controller-mobile-sheet"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="barn-controller-mobile-sheet-body-scroll min-h-0 flex-1">
        {showPicker ? (
          <ControllerMobilePickerStrip
            readings={pickerReadings}
            selectedKey={selectedReadingKey}
            onSelect={onSelectReading}
            showAffiliation={showPickerAffiliation}
            className="border-b bg-muted/20"
          />
        ) : null}
        <div
          className="border-b px-3 py-2"
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
          className="barn-controller-mobile-sheet-scroller min-w-0 overflow-x-auto"
          onScroll={handleScroll}
        >
          <div className="barn-controller-mobile-sheet-track flex w-[200%] items-start">
            <section
              className="barn-controller-mobile-sheet-page w-1/2 shrink-0"
              data-panel="controller"
              data-audit-region="controller-mobile-sheet-controller"
              aria-hidden={viewPage !== 0}
            >
              {controllerPage}
            </section>
            <section
              className="barn-controller-mobile-sheet-page w-1/2 shrink-0"
              data-panel="settings"
              data-audit-region="controller-mobile-sheet-settings-panel"
              aria-hidden={viewPage !== 1}
            >
              {settingsPage}
            </section>
          </div>
        </div>
      </div>
    </BarnPanelBottomSheet>
  );
}
