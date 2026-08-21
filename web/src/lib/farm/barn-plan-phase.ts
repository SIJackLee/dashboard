/** 모델 필드 — 건물 배치 / 칸 부여. 로컬만. */

export type BarnPlanPhase = "place" | "assign" | "model";

export function barnPlanPhaseStorageKey(farmId: string): string {
  return `sungil.barn-plan.phase.v1:${farmId}`;
}

export function parseBarnPlanPhase(raw: unknown): BarnPlanPhase {
  if (raw === "assign" || raw === "model") return raw;
  return "place";
}

/** 부여·모델 단계에서는 위성 타일을 올리지 않는다. */
export function barnPlanSatOverlayEnabled(phase: BarnPlanPhase): boolean {
  return phase === "place";
}

export function loadBarnPlanPhase(farmId: string): BarnPlanPhase {
  if (!farmId || typeof window === "undefined") return "place";
  try {
    return parseBarnPlanPhase(
      window.localStorage.getItem(barnPlanPhaseStorageKey(farmId)),
    );
  } catch {
    return "place";
  }
}

export function saveBarnPlanPhase(farmId: string, phase: BarnPlanPhase): void {
  if (!farmId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(barnPlanPhaseStorageKey(farmId), phase);
  } catch {
    /* quota */
  }
}

/** 생성 칸 색 — 알람 상하한 / 생육 권장. 기본 권장. */
export type BarnPlanEnvBandMode = "alarm" | "recommend";

export function barnPlanEnvBandStorageKey(farmId: string): string {
  return `sungil.barn-plan.env-band.v1:${farmId}`;
}

export function parseBarnPlanEnvBandMode(raw: unknown): BarnPlanEnvBandMode {
  return raw === "alarm" ? "alarm" : "recommend";
}

export function loadBarnPlanEnvBandMode(farmId: string): BarnPlanEnvBandMode {
  if (!farmId || typeof window === "undefined") return "recommend";
  try {
    return parseBarnPlanEnvBandMode(
      window.localStorage.getItem(barnPlanEnvBandStorageKey(farmId)),
    );
  } catch {
    return "recommend";
  }
}

export function saveBarnPlanEnvBandMode(
  farmId: string,
  mode: BarnPlanEnvBandMode,
): void {
  if (!farmId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(barnPlanEnvBandStorageKey(farmId), mode);
  } catch {
    /* quota */
  }
}
