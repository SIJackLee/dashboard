"use client";

import { useEffect, type ReactNode } from "react";
import type { BarnReading } from "@/lib/data/iot";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { ControllerMobilePickerStrip } from "@/components/farm/controller-mobile-picker-strip";
import { ControllerAffiliationMarks } from "@/components/farm/controller-summary-parts";

type Props = {
  open: boolean;
  onClose: () => void;
  reading: BarnReading;
  settingsPage: ReactNode;
  /** 목록 설정 — sheet 상단 컨트롤러 swipe picker */
  pickerReadings?: BarnReading[];
  selectedReadingKey?: string;
  onSelectReading?: (key: string) => void;
  showPickerAffiliation?: boolean;
  peek?: boolean;
  onPeek?: () => void;
  onExpand?: () => void;
};

/**
 * 모바일 stack — 설정 전용 bottom sheet (+ 컨트롤러 picker).
 * 그래프 모드 은퇴로 컨트롤러/설정 carousel 대신 단일 설정 페이지.
 */
export function BarnControllerMobileSheet({
  open,
  onClose,
  reading,
  settingsPage,
  pickerReadings,
  selectedReadingKey,
  onSelectReading,
  showPickerAffiliation = false,
  peek = false,
  onPeek,
  onExpand,
}: Props) {
  useEffect(() => {
    // 시트 상태 정리 훅 자리 — 현재는 no-op (props로 제어)
  }, [open]);

  const showPicker =
    pickerReadings &&
    pickerReadings.length > 0 &&
    selectedReadingKey &&
    onSelectReading;

  return (
    <BarnPanelBottomSheet
      open={open}
      onClose={onClose}
      peek={peek}
      onPeek={onPeek}
      onExpand={onExpand}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <ControllerAffiliationMarks
            stallTyCode={reading.stallTyCode}
            stallNo={reading.stallNo}
            eqpmnNo={reading.eqpmnNo}
            compactType
          />
          <span className="shrink-0 font-medium text-muted-foreground">
            · 설정
          </span>
        </span>
      }
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
          active={open && !peek}
          className="shrink-0 border-b bg-muted/20"
        />
      ) : null}
      <div
        className="barn-controller-mobile-sheet-body-scroll min-h-0 flex-1"
        data-tour-id="controller-mobile-sheet-panel"
        data-audit-region="controller-mobile-sheet-settings"
      >
        {settingsPage}
      </div>
    </BarnPanelBottomSheet>
  );
}
