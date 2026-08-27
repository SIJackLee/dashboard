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
