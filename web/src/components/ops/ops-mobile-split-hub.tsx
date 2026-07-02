"use client";

import type { ControllerReading } from "@/lib/data/iot";
import {
  OpsMobileSplitShell,
  type MobileStallOption,
} from "@/components/ops/ops-mobile-split-shell";

type Props = {
  farmLabel: string;
  positionLabel: string;
  alarmHint?: string;
  map: React.ReactNode;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  control: React.ReactNode;
  headerSlot?: React.ReactNode;
  midPanel?: React.ReactNode;
  stallOptions?: MobileStallOption[];
  selectedStallKey?: string;
  onStallSelect?: (stallKey: string) => void;
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  /** Admin 전국 허브 — placeholder 시 농장·축사 트리 */
  pickerPanel?: React.ReactNode;
  placeholder?: boolean;
  topVariant?: "map" | "grid";
  topMapCompact?: boolean;
  navSweepDirection?: "left" | "right" | null;
};

/** Admin 전국 허브 — 지도 + 제어 분할 */
export function OpsMobileSplitHub({
  farmLabel,
  positionLabel,
  alarmHint,
  map,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  control,
  headerSlot,
  midPanel,
  stallOptions,
  selectedStallKey,
  onStallSelect,
  controllerList,
  selectedControllerKey,
  onControllerSelect,
  pickerPanel,
  placeholder,
  topVariant = "map",
  topMapCompact = false,
  navSweepDirection,
}: Props) {
  return (
    <OpsMobileSplitShell
      title={farmLabel}
      subtitle={[positionLabel, alarmHint].filter(Boolean).join(" · ")}
      nav={{
        hasPrev,
        hasNext,
        onPrev,
        onNext,
        prevLabel: "이전 농장",
        nextLabel: "다음 농장",
      }}
      topPanel={map}
      topVariant={topVariant}
      topMapCompact={topMapCompact}
      control={control}
      headerSlot={headerSlot}
      midPanel={midPanel}
      pickerPanel={pickerPanel}
      stallOptions={stallOptions}
      selectedStallKey={selectedStallKey}
      onStallSelect={onStallSelect}
      controllerList={controllerList}
      selectedControllerKey={selectedControllerKey}
      onControllerSelect={onControllerSelect}
      placeholder={placeholder}
      navSweepDirection={navSweepDirection}
    />
  );
}
