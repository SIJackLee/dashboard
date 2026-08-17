import { normalizeStallTyCode } from "@/lib/data/stall-type";

/** 복도형 공통 (m). */
export const BARN_MODEL_DIM = {
  wallH: 3.2,
  aisleW: 1.8,
  yardGap: 10,
  roofRise: 1.6,
} as const;

export type BarnModelRoomPlanLike = {
  left: number;
  right: number;
};

/** 복도 방향 칸 폭(penAlong) · 복도→벽 깊이(penDepth) · 끝 여유(endPad). */
export type BarnModelTypeSpec = {
  penAlong: number;
  penDepth: number;
  endPad: number;
};

/** 한국 양돈 복도형 실측. 임신·분만은 틀 규격, 자돈·육성·비육은 법 밀도 환산. */
export const BARN_MODEL_TYPE_SPEC: Record<string, BarnModelTypeSpec> = {
  SP01: { penAlong: 0.55, penDepth: 1.8, endPad: 0.4 },
  SP02: { penAlong: 0.65, penDepth: 2.2, endPad: 0.4 },
  SP03: { penAlong: 1.8, penDepth: 2.4, endPad: 0.4 },
  SP04: { penAlong: 2.4, penDepth: 5.0, endPad: 1.0 },
  SP05: { penAlong: 2.4, penDepth: 5.0, endPad: 1.0 },
  SP06: { penAlong: 3.0, penDepth: 5.1, endPad: 1.0 },
  SP07: { penAlong: 3.6, penDepth: 6.5, endPad: 1.0 },
  SP08: { penAlong: 3.0, penDepth: 5.1, endPad: 1.0 },
  SP09: { penAlong: 0.65, penDepth: 2.2, endPad: 0.4 },
};

const FALLBACK_SPEC: BarnModelTypeSpec = BARN_MODEL_TYPE_SPEC.SP06!;

function roundMm(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function barnModelTypeSpec(stallTyCode: string): BarnModelTypeSpec {
  const code = normalizeStallTyCode(stallTyCode);
  return BARN_MODEL_TYPE_SPEC[code] ?? FALLBACK_SPEC;
}

export function barnModelWidth(
  stallTyCode: string,
  plan: BarnModelRoomPlanLike,
): number {
  const { penDepth } = barnModelTypeSpec(stallTyCode);
  const sides =
    (plan.left > 0 ? 1 : 0) + (plan.right > 0 ? 1 : 0);
  return roundMm(Math.max(sides, 1) * penDepth + BARN_MODEL_DIM.aisleW);
}

export function barnModelLength(
  stallTyCode: string,
  plan: BarnModelRoomPlanLike,
): number {
  const spec = barnModelTypeSpec(stallTyCode);
  const rows = Math.max(plan.left, plan.right, 1);
  return roundMm(rows * spec.penAlong + spec.endPad);
}

/** 복도 중심 X. 한쪽만 있으면 방이 없는 쪽으로 붙인다. */
export function barnModelAisleX(
  plan: BarnModelRoomPlanLike,
  width: number,
): number {
  const { aisleW } = BARN_MODEL_DIM;
  const left = plan.left > 0;
  const right = plan.right > 0;
  if (left && !right) return width / 2 - aisleW / 2;
  if (right && !left) return -(width / 2 - aisleW / 2);
  return 0;
}
