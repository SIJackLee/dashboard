"use client";

import type { ControllerReading } from "@/lib/data/iot";
import { OpsMobileSplitShell } from "@/components/ops/ops-mobile-split-shell";

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
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  placeholder?: boolean;
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
  controllerList,
  selectedControllerKey,
  onControllerSelect,
  placeholder,
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
        prevLabel: "이전 이상 농장",
        nextLabel: "다음 이상 농장",
      }}
      topPanel={map}
      topVariant="map"
      control={control}
      headerSlot={headerSlot}
      midPanel={midPanel}
      controllerList={controllerList}
      selectedControllerKey={selectedControllerKey}
      onControllerSelect={onControllerSelect}
      placeholder={placeholder}
    />
  );
}
