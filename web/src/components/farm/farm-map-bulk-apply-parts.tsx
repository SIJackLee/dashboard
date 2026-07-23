import type { BulkThermoCommand } from "@/app/(dashboard)/controllers/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { resolveThermoSettings } from "@/lib/controllers/controller-settings";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import {
  DEFAULT_CHANNEL_EQPMN,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
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
  /** 접이식 헤더에 제목이 있을 때 — 체크·적용 여부만 표시 */
  applyOnly = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  applyOnly?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1",
        !applyOnly && "border-b pb-2.5 md:gap-x-3 md:pb-3",
        applyOnly && "pb-2",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-emerald-600 md:size-5"
        aria-label={applyOnly ? `${label} 적용` : undefined}
      />
      {applyOnly ? (
        <span className={cn("min-w-0 flex-1 leading-snug", bulkModalMeta)}>
          {checked ? "이 값으로 적용" : "적용하지 않음"}
        </span>
      ) : (
        <>
          <span className="flex shrink-0 items-center">{icon}</span>
          <span className={cn("min-w-0 flex-1 leading-snug", bulkModalSectionTitle)}>
            {label}
          </span>
          <span className={cn("shrink-0 leading-snug", bulkModalMeta)}>
            {checked ? "적용" : "변경 안 함"}
          </span>
        </>
      )}
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
  /** 채널 컨트롤러에 보낼 슬롯 (기본 A+B). 레거시(CTRL)는 무시. */
  selectedChannels: ChannelSlot[];
};

export const BULK_CHANNEL_OPTIONS: ChannelSlot[] = ["A", "B", "C"];

function thermoValuesForReading(
  r: ControllerGridData["readings"][number],
  thermoSettings: ControllerGridData["thermoSettings"],
  draft: BulkThermoDraft,
  channel?: ChannelSlot,
) {
  const cur = resolveThermoSettings(
    thermoSettings,
    r.farmKey,
    r.moduleUid,
    r.controllerKey,
    channel,
  );
  return {
    setpointTemp: draft.applyTemp
      ? draft.setpoint
      : (cur?.setpointTemp ?? EDIT_START_DRAFT.setpointTemp),
    tempDeviation: draft.applyTemp
      ? draft.deviation
      : (cur?.tempDeviation ?? EDIT_START_DRAFT.tempDeviation),
    minVentPct: draft.applyVent
      ? draft.minVent
      : (cur?.minVentPct ?? EDIT_START_DRAFT.minVentPct),
    maxVentPct: draft.applyVent
      ? draft.maxVent
      : (cur?.maxVentPct ?? EDIT_START_DRAFT.maxVentPct),
  };
}

/**
 * 선택된 온라인 컨트롤러별 일괄 제어 명령 구성.
 * - channels[] 있음 → 선택된 활성 채널마다 SET_CHANNEL_THERMO
 * - 없음 → SET_CTRL_THERMO 1건
 * 미적용 항목은 각 대상의 현재 설정값(없으면 편집 시작 기본값)을 유지.
 */
export function buildBulkThermoCommands(
  onlineTargets: ControllerGridData["readings"],
  thermoSettings: ControllerGridData["thermoSettings"],
  draft: BulkThermoDraft
): BulkThermoCommand[] {
  const selected = new Set(draft.selectedChannels);
  const out: BulkThermoCommand[] = [];

  for (const r of onlineTargets) {
    const channels = r.channels ?? [];
    if (channels.length > 0) {
      for (const ch of channels) {
        if (!selected.has(ch.channel)) continue;
        const values = thermoValuesForReading(
          r,
          thermoSettings,
          draft,
          ch.channel,
        );
        out.push({
          key: r.key,
          lsindRegistNo: r.farmKey.lsindRegistNo,
          itemCode: r.farmKey.itemCode,
          moduleUid: r.moduleUid,
          stallTyCode: r.stallTyCode ?? "SP01",
          stallNo: r.stallNo ?? "01",
          eqpmnNo: r.eqpmnNo,
          channel: ch.channel,
          eqpmnCode: ch.eqpmnCode || DEFAULT_CHANNEL_EQPMN[ch.channel],
          ...values,
        });
      }
      continue;
    }

    const values = thermoValuesForReading(r, thermoSettings, draft);
    out.push({
      key: r.key,
      lsindRegistNo: r.farmKey.lsindRegistNo,
      itemCode: r.farmKey.itemCode,
      moduleUid: r.moduleUid,
      stallTyCode: r.stallTyCode ?? "SP01",
      stallNo: r.stallNo ?? "01",
      eqpmnNo: r.eqpmnNo,
      channel: null,
      eqpmnCode: null,
      ...values,
    });
  }

  return out;
}
