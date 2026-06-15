"use client";

import { useControllerMeta } from "@/components/controllers/controller-meta-provider";
import {
  formatControllerSlotLabel,
  formatControllerSlotSuffix,
} from "@/lib/ui/controller-labels";
import { cn } from "@/lib/utils";

type ControllerNameLabelProps = {
  /** 명시적 이름(편집 중 등). 없으면 전역 메타·슬롯 fallback */
  name?: string | null;
  /** BarnReading.label 과 동일 — 있으면 슬롯 fallback 우선 */
  label?: string;
  stallNo?: string | null;
  eqpmnNo?: string;
  controllerKey?: string;
  /** @deprecated legacy v0x09 */
  idx?: number;
  className?: string;
};

export function ControllerNameLabel({
  name,
  label,
  stallNo,
  eqpmnNo,
  controllerKey,
  idx,
  className,
}: ControllerNameLabelProps) {
  const { resolveName } = useControllerMeta();
  const slotLabel =
    label ??
    formatControllerSlotLabel({ stallNo, eqpmnNo, idx });
  const metaName =
    name ??
    (controllerKey && eqpmnNo
      ? resolveName(controllerKey, eqpmnNo)
      : null);

  const text = metaName?.trim()
    ? `${metaName.trim()}${formatControllerSlotSuffix({ stallNo, eqpmnNo })}`
    : slotLabel;

  return (
    <span className={cn("font-medium", className)} title={controllerKey}>
      {text}
    </span>
  );
}
