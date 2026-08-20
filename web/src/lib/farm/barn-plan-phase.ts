/** 모델 필드 — 건물 배치 / 칸 부여. 로컬만. */

export type BarnPlanPhase = "place" | "assign";

export function barnPlanPhaseStorageKey(farmId: string): string {
  return `sungil.barn-plan.phase.v1:${farmId}`;
}

export function parseBarnPlanPhase(raw: unknown): BarnPlanPhase {
  return raw === "assign" ? "assign" : "place";
}

/** 부여 단계에서는 위성 타일을 올리지 않는다. */
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
