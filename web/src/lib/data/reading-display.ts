import type { ControllerStatus } from "@/lib/data/iot";

export function isReadingOnline(status: ControllerStatus | undefined): boolean {
  return !!status && status !== "offline";
}

/** 오프라인 판정 시 센서·팬 수치를 UI에 노출하지 않음 */
export function sensorValueForDisplay(
  status: ControllerStatus | undefined,
  value: number | null | undefined
): number | null {
  if (!isReadingOnline(status)) return null;
  return value ?? null;
}
