import { normalizeStallTyCode } from "@/lib/data/stall-type";

/** 복도형 공통 (m). */
export const BARN_MODEL_DIM = {
  wallH: 3.2,
  aisleW: 1.8,
  /** 복도 바닥. 카드 평면도도 이 색을 쓴다. */
  aisleHex: "#78716c",
  yardGap: 10,
  roofRise: 1.6,
} as const;

export type BarnModelRoomPlanLike = {
  left: number;
  right: number;
  mid?: number;
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

/** 축사표준설계도 평면 카탈로그 동 길이 상한(m). 법령 상한 아님. */
export const BARN_MODEL_LENGTH_MAX_M = 120;
export const BARN_MODEL_LENGTH_MIN_M = 0.8;
export const BARN_MODEL_WIDTH_MIN_M = 3;
export const BARN_MODEL_WIDTH_MAX_M = 40;
export const BARN_MODEL_HEIGHT_MIN_M = 2;
export const BARN_MODEL_HEIGHT_MAX_M = 12;

export type BarnModelDimAxis = "length" | "width" | "height";

export const BARN_MODEL_BANKS = [1, 2, 3, 4, 5] as const;
export type BarnModelBanks = (typeof BARN_MODEL_BANKS)[number];
export const BARN_MODEL_BANKS_MAX = 5;

export type BarnModelShellLike = {
  stallTyCode: string;
  plan: BarnModelRoomPlanLike;
  lengthM?: number;
  widthM?: number;
  wallHM?: number;
  banks?: BarnModelBanks;
  penAlongM?: number;
  penDepthM?: number;
  aisleWM?: number;
};

export const BARN_MODEL_PEN_ALONG_MIN_M = 0.3;
export const BARN_MODEL_PEN_ALONG_MAX_M = 12;
export const BARN_MODEL_PEN_DEPTH_MIN_M = 0.4;
export const BARN_MODEL_PEN_DEPTH_MAX_M = 16;
export const BARN_MODEL_AISLE_MIN_M = 0.8;
export const BARN_MODEL_AISLE_MAX_M = 5;

function roundMm(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clampM(n: number, min: number, max: number): number {
  return roundMm(Math.min(max, Math.max(min, n)));
}

export function clampBarnLengthM(n: number): number {
  return clampM(n, BARN_MODEL_LENGTH_MIN_M, BARN_MODEL_LENGTH_MAX_M);
}

export function clampBarnWidthM(n: number): number {
  return clampM(n, BARN_MODEL_WIDTH_MIN_M, BARN_MODEL_WIDTH_MAX_M);
}

export function clampBarnHeightM(n: number): number {
  return clampM(n, BARN_MODEL_HEIGHT_MIN_M, BARN_MODEL_HEIGHT_MAX_M);
}

export function clampBarnPenAlongM(n: number): number {
  return clampM(n, BARN_MODEL_PEN_ALONG_MIN_M, BARN_MODEL_PEN_ALONG_MAX_M);
}

export function clampBarnPenDepthM(n: number): number {
  return clampM(n, BARN_MODEL_PEN_DEPTH_MIN_M, BARN_MODEL_PEN_DEPTH_MAX_M);
}

export function clampBarnAisleW(n: number): number {
  return clampM(n, BARN_MODEL_AISLE_MIN_M, BARN_MODEL_AISLE_MAX_M);
}

export function clampBarnBanks(n: number): BarnModelBanks {
  if (!Number.isFinite(n) || n <= 1) return 1;
  if (n >= BARN_MODEL_BANKS_MAX) return BARN_MODEL_BANKS_MAX;
  return Math.round(n) as BarnModelBanks;
}

export function aisleCountForBanks(banks: BarnModelBanks): number {
  return banks <= 1 ? 1 : banks - 1;
}

export function banksFromPlan(plan: BarnModelRoomPlanLike): BarnModelBanks {
  if ((plan.mid ?? 0) > 0) return 3;
  if (plan.left > 0 && plan.right > 0) return 2;
  return 1;
}

export function roomCountFromPlan(plan: BarnModelRoomPlanLike): number {
  return Math.max(plan.left, plan.right, plan.mid ?? 0, 1);
}

export function planFromFill(
  banks: BarnModelBanks,
  roomCount: number,
): { left: number; right: number; mid?: number } {
  const n = Math.max(1, Math.round(roomCount));
  if (banks === 1) return { left: n, right: 0 };
  if (banks === 2) return { left: n, right: n };
  return { left: n, mid: n, right: n };
}

export function clampBarnDimMeters(axis: BarnModelDimAxis, n: number): number | null {
  if (!Number.isFinite(n)) return null;
  if (axis === "length") return clampBarnLengthM(n);
  if (axis === "width") return clampBarnWidthM(n);
  return clampBarnHeightM(n);
}

export function barnModelTypeSpec(stallTyCode: string): BarnModelTypeSpec {
  const code = normalizeStallTyCode(stallTyCode);
  return BARN_MODEL_TYPE_SPEC[code] ?? FALLBACK_SPEC;
}

/** 동 길이 120m에 들어가는 한쪽 최대 칸 수. 유형 없으면 전 유형 중 최댓값. */
export function maxRoomCount(stallTyCode = "", penAlong?: number): number {
  if (!stallTyCode && penAlong == null) {
    let max = 1;
    for (const code of Object.keys(BARN_MODEL_TYPE_SPEC)) {
      max = Math.max(max, maxRoomCount(code));
    }
    return max;
  }
  const spec = stallTyCode ? barnModelTypeSpec(stallTyCode) : FALLBACK_SPEC;
  const along = penAlong ?? spec.penAlong;
  return Math.max(
    1,
    Math.floor((BARN_MODEL_LENGTH_MAX_M - spec.endPad) / along + 1e-9),
  );
}

export type BarnModelFill = {
  penAlong: number;
  penDepth: number;
  aisleW: number;
  endPad: number;
  banks: BarnModelBanks;
  roomCount: number;
};

/** 방 치수·열·칸 수. 표준안이 기본, 사용자 값과 예전 길·폭 입력을 반영. */
export function barnModelFill(input: BarnModelShellLike): BarnModelFill {
  const spec = barnModelTypeSpec(input.stallTyCode);
  const banks = input.banks ?? banksFromPlan(input.plan);
  const roomCount = roomCountFromPlan(input.plan);
  const aisleN = aisleCountForBanks(banks);
  const aisleW =
    input.aisleWM == null
      ? BARN_MODEL_DIM.aisleW
      : clampBarnAisleW(input.aisleWM);
  const penAlong =
    input.penAlongM == null
      ? input.lengthM == null
        ? spec.penAlong
        : clampBarnPenAlongM((input.lengthM - spec.endPad) / roomCount)
      : clampBarnPenAlongM(input.penAlongM);
  const penDepth =
    input.penDepthM == null
      ? input.widthM == null
        ? spec.penDepth
        : clampBarnPenDepthM((input.widthM - aisleN * aisleW) / banks)
      : clampBarnPenDepthM(input.penDepthM);
  return { penAlong, penDepth, aisleW, endPad: spec.endPad, banks, roomCount };
}

export function barnModelWidth(
  stallTyCode: string,
  plan: BarnModelRoomPlanLike,
): number {
  return barnModelShell({ stallTyCode, plan }).width;
}

export function barnModelLength(
  stallTyCode: string,
  plan: BarnModelRoomPlanLike,
): number {
  return barnModelShell({ stallTyCode, plan }).length;
}

export function barnModelAisleCenters(
  width: number,
  banks: BarnModelBanks,
  penDepth: number,
  aisleW: number = BARN_MODEL_DIM.aisleW,
): number[] {
  const aisleN = aisleCountForBanks(banks);
  const left = -width / 2;
  return Array.from({ length: aisleN }, (_, i) =>
    roundMm(left + (i + 1) * penDepth + i * aisleW + aisleW / 2),
  );
}

export function barnModelBankCenters(
  width: number,
  banks: BarnModelBanks,
  penDepth: number,
  aisleW: number = BARN_MODEL_DIM.aisleW,
): number[] {
  const left = -width / 2;
  return Array.from({ length: banks }, (_, i) =>
    roundMm(left + i * (penDepth + aisleW) + penDepth / 2),
  );
}

export function barnModelBankSide(
  banks: BarnModelBanks,
  bankIndex: number,
): "left" | "mid" | "right" {
  if (bankIndex <= 0) return "left";
  if (bankIndex >= banks - 1) return "right";
  return "mid";
}

/** 복도 중심 X. 한쪽만 있으면 방이 없는 쪽으로 붙인다. */
export function barnModelAisleX(
  plan: BarnModelRoomPlanLike,
  width: number,
  fill?: Pick<BarnModelFill, "banks" | "penDepth" | "aisleW">,
): number {
  const banks = fill?.banks ?? banksFromPlan(plan);
  const penDepth = fill?.penDepth ?? barnModelPenDepth(plan, width, banks);
  return barnModelAisleCenters(width, banks, penDepth, fill?.aisleW)[0] ?? 0;
}

export function barnModelPenDepth(
  plan: BarnModelRoomPlanLike,
  width: number,
  banks = banksFromPlan(plan),
): number {
  const n = Math.max(banks, 1);
  const aisleN = aisleCountForBanks(clampBarnBanks(n));
  return roundMm(
    Math.max(0.4, (width - aisleN * BARN_MODEL_DIM.aisleW) / n),
  );
}

/** 방·열·칸으로 구한 껍데기. 높이는 치수 입력이 있으면 그걸 쓴다. */
export function barnModelShell(input: BarnModelShellLike): {
  length: number;
  width: number;
  wallH: number;
} {
  const fill = barnModelFill(input);
  const aisleN = aisleCountForBanks(fill.banks);
  const fromFillL = fill.roomCount * fill.penAlong + fill.endPad;
  const fromFillW =
    fill.banks * fill.penDepth + aisleN * fill.aisleW;
  return {
    length: clampBarnLengthM(
      input.penAlongM == null && input.lengthM != null
        ? input.lengthM
        : fromFillL,
    ),
    width: clampBarnWidthM(
      input.penDepthM == null && input.widthM != null
        ? input.widthM
        : fromFillW,
    ),
    wallH:
      input.wallHM == null
        ? BARN_MODEL_DIM.wallH
        : clampBarnHeightM(input.wallHM),
  };
}
