"use client";

import {
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { formatStallTypeLabelCompact } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { cn } from "@/lib/utils";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { StallUnitIcon } from "@/components/icons/stall-unit-icon";

/** PC: 아이콘 우하단 오버레이. 모바일: 아이콘·숫자 나란히 */
function NoMarkFrame({
  label,
  className,
  iconClassName,
  digit,
  Icon,
}: {
  label: string;
  className?: string;
  iconClassName?: string;
  digit: string;
  Icon: typeof ControllerDeviceIcon | typeof StallUnitIcon;
}) {
  const compact = useHydrationSafeDashboardCompact();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 align-middle",
        compact ? "items-center gap-1" : "relative items-center",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Icon
        className={cn(
          "shrink-0 text-muted-foreground",
          compact ? "size-6" : "size-[1.35em]",
          iconClassName,
          compact && "size-6",
        )}
        numberCutout={!compact}
        aria-hidden
      />
      <span
        className={cn(
          "font-bold tabular-nums leading-none text-foreground",
          compact
            ? "text-base"
            : cn(
                "pointer-events-none absolute bottom-0 right-0 z-[1] text-[0.68em]",
                "[-webkit-text-stroke:1.5px_var(--card)]",
                "[paint-order:stroke_fill]",
              ),
        )}
        aria-hidden
      >
        {digit}
      </span>
    </span>
  );
}

/** 컨트롤러 번호 — PC는 장치 아이콘 우하단 오버레이, 모바일은 아이콘+번호 나란히 */
export function ControllerNoMark({
  eqpmnNo,
  className,
  iconClassName,
}: {
  eqpmnNo: string | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const eq = normalizeEqpmnNo(eqpmnNo ?? "01");
  const noLabel = formatControllerNoLabel(eqpmnNo);
  return (
    <NoMarkFrame
      label={`컨트롤러 ${noLabel}`}
      className={className}
      iconClassName={iconClassName}
      digit={eq}
      Icon={ControllerDeviceIcon}
    />
  );
}

/** 축사 번호 — PC는 창고 아이콘 우하단 오버레이, 모바일은 아이콘+번호 나란히 */
export function StallUnitNoMark({
  stallNo,
  className,
  iconClassName,
}: {
  stallNo: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const key = stallKeyFromReading({ stallNo: stallNo ?? null });
  const display = key.startsWith("__") ? "—" : key;
  const unitLabel = formatControllerHeaderStallUnit({
    stallNo: stallNo ?? null,
    controllerKey: undefined,
    idx: undefined,
  });
  return (
    <NoMarkFrame
      label={unitLabel}
      className={className}
      iconClassName={iconClassName}
      digit={display}
      Icon={StallUnitIcon}
    />
  );
}

/** 축사유형 + 축사/컨트롤러 아이콘·번호. PC 카드 헤더와 모바일 피커·시트 공용 */
export function ControllerAffiliationMarks({
  stallTyCode,
  stallNo,
  eqpmnNo,
  showType = true,
  compactType = false,
  className,
  typeClassName,
}: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string;
  showType?: boolean;
  compactType?: boolean;
  className?: string;
  typeClassName?: string;
}) {
  const typeLabel = compactType
    ? formatStallTypeLabelCompact(stallTyCode)
    : formatControllerHeaderStallType({ stallTyCode: stallTyCode ?? "" });
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {showType ? (
        <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>
      ) : null}
      <StallUnitNoMark stallNo={stallNo} />
      <ControllerNoMark eqpmnNo={eqpmnNo} />
    </span>
  );
}
