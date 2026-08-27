"use client";

import type { BarnReading } from "@/lib/data/iot";
import {
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import {
  controllerEnvCoverLabel,
  type ControllerEnvCoverLevel,
} from "@/lib/farm/controller-env-cover";
import {
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const COVER_FILL: Record<ControllerEnvCoverLevel, string> = {
  ok: "bg-[var(--status-ok)] text-primary-foreground",
  warn: "bg-[var(--status-warn)] text-foreground",
  danger: "bg-[var(--status-danger)] text-destructive-foreground",
  offline: "bg-muted text-muted-foreground",
};

type Props = {
  reading: BarnReading;
  level: ControllerEnvCoverLevel;
  onOpen: () => void;
};

/** 기존 컨트롤러 카드 위 상태색 덮개. 정식 명칭·축사번호·컨트롤러 번호만. */
export function ControllerEnvCover({ reading, level, onOpen }: Props) {
  const typeLabel = formatControllerHeaderStallType(reading);
  const stallLabel = formatControllerHeaderStallUnit(reading);
  const ctrlLabel = `컨트롤러 ${formatControllerNoLabel(reading.eqpmnNo)}`;
  const statusLabel = controllerEnvCoverLabel(level);
  const onFill = level !== "offline";

  return (
    <button
      type="button"
      data-farm-env-cover="on"
      aria-label={`${typeLabel} ${stallLabel} ${ctrlLabel}, ${statusLabel}. 상세 보기`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "absolute inset-0 z-10 flex flex-col justify-end gap-1 p-2.5 text-left sm:p-3",
        COVER_FILL[level],
        motionClass.enterFade,
        motionClass.microHover,
      )}
    >
      <span
        className={cn(
          "break-keep",
          dashboardTypography.cardTitle,
          onFill && "text-current",
        )}
      >
        {typeLabel}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <StallUnitNoMark
          stallNo={reading.stallNo}
          onFill={onFill}
          className={cn(dashboardTypography.cardDesc, onFill && "text-current")}
        />
        <ControllerNoMark
          eqpmnNo={reading.eqpmnNo}
          onFill={onFill}
          className={cn(dashboardTypography.cardDesc, onFill && "text-current")}
        />
      </span>
    </button>
  );
}
