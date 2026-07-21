"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { BarnReading } from "@/lib/data/iot";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { ControllerMobilePickerStrip } from "@/components/farm/controller-mobile-picker-strip";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";

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

const SWIPE_THRESHOLD_PX = 56;

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

/**
 * 모바일 stack — picker·탭·본문.
 * Dialog enter transform과 충돌하지 않도록 페이지 전환은 scrollLeft 대신 translateX 사용.
 */
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
  const [viewPage, setViewPage] = useState<ControllerMobileSheetPage>(initialPage);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lockAxisRef = useRef<"x" | "y" | null>(null);
  const viewPageRef = useRef(viewPage);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewPageRef.current = viewPage;
  }, [viewPage]);

  useEffect(() => {
    if (!open) {
      setDragOffsetPx(0);
      setDragging(false);
      touchStartXRef.current = null;
      lockAxisRef.current = null;
      return;
    }
    setViewPage(initialPage);
    setDragOffsetPx(0);
  }, [open, initialPage]);

  const selectTab = useCallback(
    (page: ControllerMobileSheetPage) => {
      setViewPage(page);
      setDragOffsetPx(0);
      onPageSettled?.(page);
    },
    [onPageSettled],
  );

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    // 슬라이더 핸들 조작은 페이지 스와이프로 해석하지 않음
    if (
      e.target instanceof Element &&
      e.target.closest('input[type="range"], [data-sheet-swipe-ignore]')
    ) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      lockAxisRef.current = null;
      return;
    }
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
    lockAxisRef.current = null;
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const t = e.touches[0];
    if (startX == null || startY == null || !t) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (lockAxisRef.current == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      lockAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (lockAxisRef.current === "y") {
        setDragging(false);
        setDragOffsetPx(0);
        return;
      }
    }

    if (lockAxisRef.current !== "x") return;

    const page = viewPageRef.current;
    const width = viewportRef.current?.clientWidth ?? 1;
    let next = dx;
    if (page === 0 && dx > 0) next = dx * 0.25;
    if (page === 1 && dx < 0) next = dx * 0.25;
    next = Math.max(-width, Math.min(width, next));
    setDragOffsetPx(next);
  }, []);

  const onTouchEnd = useCallback(() => {
    const offset = dragOffsetPx;
    const page = viewPageRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    lockAxisRef.current = null;
    setDragging(false);

    if (Math.abs(offset) < SWIPE_THRESHOLD_PX) {
      setDragOffsetPx(0);
      return;
    }

    const next = offset < 0 ? clampPage(page + 1) : clampPage(page - 1);
    setViewPage(next);
    setDragOffsetPx(0);
    if (next !== page) onPageSettled?.(next);
  }, [dragOffsetPx, onPageSettled]);

  const eqpmn = formatControllerNoLabel(reading.eqpmnNo);
  const activeLabel =
    CONTROLLER_MOBILE_SHEET_PAGES.find((p) => p.id === viewPage)?.label ?? "";

  const showPicker =
    pickerReadings &&
    pickerReadings.length > 0 &&
    selectedReadingKey &&
    onSelectReading;

  const trackTransform = `translate3d(calc(${viewPage * -50}% + ${dragOffsetPx}px), 0, 0)`;

  return (
    <BarnPanelBottomSheet
      open={open}
      onClose={onClose}
      title={`${eqpmn} · ${activeLabel}`}
      auditRegion="barn-controller-mobile-sheet"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      suppressFocusOutClose
    >
      {showPicker ? (
        <ControllerMobilePickerStrip
          readings={pickerReadings}
          selectedKey={selectedReadingKey}
          onSelect={onSelectReading}
          showAffiliation={showPickerAffiliation}
          active={open}
          className="shrink-0 border-b bg-muted/20"
        />
      ) : null}
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
              onClick={() => selectTab(p.id)}
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

      <div className="barn-controller-mobile-sheet-body-scroll min-h-0 flex-1">
        <div
          ref={viewportRef}
          className="barn-controller-mobile-sheet-scroller min-h-0 min-w-0 overflow-x-hidden overflow-y-visible"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div
            className={cn(
              "barn-controller-mobile-sheet-track flex w-[200%] items-start will-change-transform",
              !dragging && motionClass.durationModerate,
              !dragging && "transition-transform ease-out",
            )}
            style={{ transform: trackTransform }}
          >
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
