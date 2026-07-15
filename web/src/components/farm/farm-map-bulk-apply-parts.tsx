import type { BulkThermoCommand } from "@/app/(dashboard)/controllers/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { resolveThermoSettings } from "@/lib/controllers/controller-settings";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { cn } from "@/lib/utils";

/** 일괄설정 모달 — Card 상속 타이포 차단 + 뷰포트별 스케일 */
export const bulkModalShell = cn(
  "flex max-h-[min(88dvh,960px)] w-full min-w-0 max-w-[min(100%,44rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
  "text-sm leading-snug md:text-base md:leading-snug lg:text-[1.75rem] lg:leading-snug"
);
export const bulkModalSectionTitle = "font-semibold text-foreground";
export const bulkModalMeta = "text-muted-foreground";
export const bulkModalThumbLabel = "text-sm leading-snug lg:text-[1.75rem]";
export const bulkModalBtn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug md:px-4 lg:min-h-12 lg:px-5 lg:text-[1.75rem]";
export const bulkModalSection = "min-w-0 rounded-lg border bg-background p-3 md:p-5";
export const bulkModalTrackShell = "lg:py-12 lg:pt-14";

export function SectionToggle({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 border-b pb-2.5 md:gap-x-3 md:pb-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-emerald-600 md:size-5"
      />
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className={cn("min-w-0 flex-1 leading-snug", bulkModalSectionTitle)}>
        {label}
      </span>
      <span className={cn("shrink-0 leading-snug", bulkModalMeta)}>
        {checked ? "적용" : "변경 안 함"}
      </span>
    </label>
  );
}

export type BulkThermoDraft = {
  applyTemp: boolean;
  applyVent: boolean;
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
};

/**
 * 선택된 온라인 컨트롤러별 일괄 제어 명령 구성.
 * 미적용 항목은 각 컨트롤러의 현재 설정값(없으면 편집 시작 기본값)을 유지.
 */
export function buildBulkThermoCommands(
  onlineTargets: ControllerGridData["readings"],
  thermoSettings: ControllerGridData["thermoSettings"],
  draft: BulkThermoDraft
): BulkThermoCommand[] {
  const { applyTemp, applyVent, setpoint, deviation, minVent, maxVent } = draft;
  return onlineTargets.map((r) => {
    const cur = resolveThermoSettings(
      thermoSettings,
      r.farmKey,
      r.moduleUid,
      r.controllerKey
    );
    return {
      key: r.key,
      lsindRegistNo: r.farmKey.lsindRegistNo,
      itemCode: r.farmKey.itemCode,
      moduleUid: r.moduleUid,
      stallTyCode: r.stallTyCode ?? "SP01",
      stallNo: r.stallNo ?? "01",
      eqpmnNo: r.eqpmnNo,
      setpointTemp: applyTemp
        ? setpoint
        : cur?.setpointTemp ?? EDIT_START_DRAFT.setpointTemp,
      tempDeviation: applyTemp
        ? deviation
        : cur?.tempDeviation ?? EDIT_START_DRAFT.tempDeviation,
      minVentPct: applyVent
        ? minVent
        : cur?.minVentPct ?? EDIT_START_DRAFT.minVentPct,
      maxVentPct: applyVent
        ? maxVent
        : cur?.maxVentPct ?? EDIT_START_DRAFT.maxVentPct,
    };
  });
}
