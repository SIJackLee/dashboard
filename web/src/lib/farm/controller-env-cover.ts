import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  barnPlanRoomEnvTint,
  type BarnPlanCoverClimateTone,
} from "@/lib/farm/barn-site-live";

export type ControllerEnvCoverLevel = BarnPlanCoverClimateTone;

/** 필드 카드 덮개 채점 — 생성과 같은 권장 띠. 안전망·온습 둘 다 이탈=위험. */
export function controllerEnvCoverLevel(
  reading: Pick<
    BarnReading,
    "status" | "tempC" | "humidityPct" | "stallTyCode"
  > &
    Partial<Pick<BarnReading, "farmKey" | "stallNo" | "controllerKey" | "eqpmnNo">>,
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverLevel {
  if (reading.status === "offline") return "offline";
  return (
    barnPlanRoomEnvTint(reading, { mode: "recommend", alarmSettings }) ?? "ok"
  );
}

export function controllerEnvCoverLabel(level: ControllerEnvCoverLevel): string {
  if (level === "ok") return "정상";
  if (level === "warn") return "주의";
  if (level === "danger") return "위험";
  return "연결 끊김";
}

/** 헤더 점 — 덮개와 같은 판정색. emerald/amber 하드코딩 금지. */
export function controllerEnvCoverFillClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "bg-[var(--status-ok)]";
  if (level === "warn") return "bg-[var(--status-warn)]";
  if (level === "danger") return "bg-[var(--status-danger)]";
  return "bg-muted-foreground";
}

/** 카드 테두리 — 덮개·점과 같은 판정색. */
export function controllerEnvCoverRingClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-ok)_70%,transparent)] -outline-offset-1";
  }
  if (level === "warn") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-warn)_80%,transparent)] -outline-offset-1";
  }
  if (level === "danger") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-danger)_80%,transparent)] -outline-offset-1";
  }
  return "outline outline-2 outline-muted-foreground/40 -outline-offset-1";
}

/** 차트·설정·명칭 등 실제 컨트롤. 여기가 아니면 덮개 다시 닫기. */
export const CONTROLLER_PANEL_INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, summary, label, [role='button'], [role='switch'], [role='tab'], [role='slider'], [role='combobox'], [role='menuitem']";

export function isControllerPanelInteractiveTarget(
  target: EventTarget | null,
): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return Boolean(el?.closest(CONTROLLER_PANEL_INTERACTIVE_SELECTOR));
}
