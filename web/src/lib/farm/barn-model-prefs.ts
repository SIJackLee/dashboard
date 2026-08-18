/** 모델 탭 배치 — 로컬만 (DB 없음). 빈 필드에서 사용자가 축사를 놓는다. */

import {
  barnModelFill,
  barnModelLength,
  barnModelShell,
  barnModelWidth,
  banksFromPlan,
  clampBarnAisleW,
  clampBarnBanks,
  clampBarnDimMeters,
  clampBarnPenAlongM,
  clampBarnPenDepthM,
  maxRoomCount,
  planFromFill,
  roomCountFromPlan,
  type BarnModelBanks,
  type BarnModelDimAxis,
} from "@/lib/farm/barn-model-dim";

export type { BarnModelBanks, BarnModelDimAxis };

export const BARN_MODEL_PREFS_VERSION = 2;
/** 필드에 보이는 짙은 격자. */
export const BARN_MODEL_SNAP_M = 5;
/** 상세 격자 · 배치·편집 이동. */
export const BARN_MODEL_SNAP_FINE_M = 1;
/** 0·45·90이 포함되는 최소 단위. */
export const BARN_MODEL_SNAP_DEG = 15;

function roundMm(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function rotateXZ(x: number, z: number, rotDeg: number): [number, number] {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - z * s, x * s + z * c];
}

export function snapBarnXZ(
  x: number,
  z: number,
  snapM = BARN_MODEL_SNAP_M,
): [number, number] {
  const s = snapM > 0 ? snapM : BARN_MODEL_SNAP_M;
  return [roundMm(Math.round(x / s) * s), roundMm(Math.round(z / s) * s)];
}

export function snapBarnRotDeg(deg: number): number {
  const s = BARN_MODEL_SNAP_DEG;
  const wrapped = ((deg % 360) + 360) % 360;
  const snapped = Math.round(wrapped / s) * s;
  return snapped === 360 ? 0 : snapped;
}

/** 축사 뒤·왼쪽 모서리를 격자에 붙인 뒤 중심으로 환산. */
export function snapBarnFootprint(
  x: number,
  z: number,
  plan: BarnModelRoomPlan,
  stallTyCode = "",
  shell?: { width?: number; length?: number },
  snapM = BARN_MODEL_SNAP_M,
): [number, number] {
  const s = snapM > 0 ? snapM : BARN_MODEL_SNAP_M;
  const halfW = (shell?.width ?? barnModelWidth(stallTyCode, plan)) / 2;
  const halfL = (shell?.length ?? barnModelLength(stallTyCode, plan)) / 2;
  const minX = Math.round((x - halfW) / s) * s;
  const minZ = Math.round((z - halfL) / s) * s;
  return [roundMm(minX + halfW), roundMm(minZ + halfL)];
}

export type BarnModelRoomPlan = {
  left: number;
  right: number;
  mid?: number;
};

export type BarnModelPlacedBarn = {
  id: string;
  stallTyCode: string;
  stallNo: string;
  /** 사용자가 붙인 표시 이름. 없으면 유형+번호. */
  name?: string;
  x: number;
  z: number;
  /** 시계 반대, 도. 0 = 입구가 +Z */
  rotDeg: number;
  plan: BarnModelRoomPlan;
  /** 복도식 방열 수. 없으면 평면도에서 추론. */
  banks?: BarnModelBanks;
  /** 방의 복도 방향 치수(m). 없으면 유형 표준안. */
  penAlongM?: number;
  /** 방 깊이(m). 없으면 유형 표준안. */
  penDepthM?: number;
  /** 복도 폭(m). 없으면 1.8. */
  aisleWM?: number;
  /** 사용자 입력 동 길이(m). 없으면 표준안×칸 수. */
  lengthM?: number;
  /** 사용자 입력 동 폭(m). 없으면 표준안 방열+복도. */
  widthM?: number;
  /** 사용자 입력 벽 높이(m). 없으면 표준 3.2. */
  wallHM?: number;
};

export type BarnModelBarnOverride = {
  plan?: BarnModelRoomPlan;
  /** `${side}-${index}` → controllerKey */
  slots: Record<string, string>;
};

export type BarnModelLayoutPrefs = {
  v: typeof BARN_MODEL_PREFS_VERSION;
  placed: BarnModelPlacedBarn[];
  byType: Record<string, BarnModelRoomPlan>;
  byBarn: Record<string, BarnModelBarnOverride>;
};

export function emptyBarnModelPrefs(): BarnModelLayoutPrefs {
  return {
    v: BARN_MODEL_PREFS_VERSION,
    placed: [],
    byType: {},
    byBarn: {},
  };
}

export function barnModelPrefsStorageKey(farmId: string): string {
  return `sungil.barn-model.layout.v2:${farmId}`;
}

export function clampRoomCount(
  n: number,
  stallTyCode = "",
  penAlong?: number,
): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(
    0,
    Math.min(maxRoomCount(stallTyCode, penAlong), Math.round(n)),
  );
}

export function clampPlan(
  plan: BarnModelRoomPlan,
  stallTyCode = "",
  penAlong?: number,
): BarnModelRoomPlan {
  const next: BarnModelRoomPlan = {
    left: clampRoomCount(plan.left, stallTyCode, penAlong),
    right: clampRoomCount(plan.right, stallTyCode, penAlong),
  };
  if (plan.mid != null && plan.mid > 0) {
    next.mid = clampRoomCount(plan.mid, stallTyCode, penAlong);
  }
  return next;
}

export function planRoomCount(plan: BarnModelRoomPlan): number {
  return plan.left + plan.right + (plan.mid ?? 0);
}

export function defaultPlanFromCount(controllerCount: number): BarnModelRoomPlan {
  const n = clampRoomCount(controllerCount);
  return { left: Math.ceil(n / 2), right: Math.floor(n / 2) };
}

export function slotKey(
  side: "left" | "right" | "mid",
  index: number,
): string {
  return `${side}-${index}`;
}

function newPlacedId(): string {
  return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parsePlan(raw: unknown): BarnModelRoomPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { left?: unknown; right?: unknown; mid?: unknown };
  const mid = Number(p.mid) || 0;
  return clampPlan({
    left: Number(p.left) || 0,
    right: Number(p.right) || 0,
    ...(mid > 0 ? { mid } : {}),
  });
}

function parseOptMeter(raw: unknown, axis: BarnModelDimAxis): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  const clamped = clampBarnDimMeters(axis, n);
  return clamped == null ? undefined : clamped;
}

function parseOptPen(raw: unknown, kind: "along" | "depth" | "aisle"): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (kind === "along") return clampBarnPenAlongM(n);
  if (kind === "depth") return clampBarnPenDepthM(n);
  return clampBarnAisleW(n);
}

function parsePlaced(raw: unknown): BarnModelPlacedBarn | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const stallTyCode = typeof o.stallTyCode === "string" ? o.stallTyCode : "";
  if (!id || !stallTyCode) return null;
  let plan = clampPlan(parsePlan(o.plan) ?? { left: 3, right: 3 }, stallTyCode);
  if (planRoomCount(plan) === 0) plan.left = 1;
  const banksRaw = Number(o.banks);
  const banks = Number.isFinite(banksRaw)
    ? clampBarnBanks(banksRaw)
    : banksFromPlan(plan);
  if (banks === 3 && (plan.mid ?? 0) <= 0) {
    const n = roomCountFromPlan(plan);
    plan = { left: n, mid: n, right: n };
  }
  const lengthM = parseOptMeter(o.lengthM, "length");
  const widthM = parseOptMeter(o.widthM, "width");
  const wallHM = parseOptMeter(o.wallHM, "height");
  const penAlongM = parseOptPen(o.penAlongM, "along");
  const penDepthM = parseOptPen(o.penDepthM, "depth");
  const aisleWM = parseOptPen(o.aisleWM, "aisle");
  const shell = barnModelShell({
    stallTyCode,
    plan,
    banks,
    ...(lengthM != null ? { lengthM } : {}),
    ...(widthM != null ? { widthM } : {}),
    ...(wallHM != null ? { wallHM } : {}),
    ...(penAlongM != null ? { penAlongM } : {}),
    ...(penDepthM != null ? { penDepthM } : {}),
    ...(aisleWM != null ? { aisleWM } : {}),
  });
  const [x, z] = snapBarnFootprint(
    Number(o.x) || 0,
    Number(o.z) || 0,
    plan,
    stallTyCode,
    { width: shell.width, length: shell.length },
  );
  const name =
    typeof o.name === "string" ? o.name.trim().slice(0, 24) : "";
  return {
    id,
    stallTyCode,
    stallNo: typeof o.stallNo === "string" ? o.stallNo : "",
    ...(name ? { name } : {}),
    x,
    z,
    rotDeg: snapBarnRotDeg(Number(o.rotDeg) || 0),
    plan,
    banks,
    ...(penAlongM != null ? { penAlongM } : {}),
    ...(penDepthM != null ? { penDepthM } : {}),
    ...(aisleWM != null ? { aisleWM } : {}),
    ...(lengthM != null ? { lengthM } : {}),
    ...(widthM != null ? { widthM } : {}),
    ...(wallHM != null ? { wallHM } : {}),
  };
}

export function parseBarnModelPrefs(raw: unknown): BarnModelLayoutPrefs {
  const empty = emptyBarnModelPrefs();
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const placed: BarnModelPlacedBarn[] = [];
  if (Array.isArray(obj.placed)) {
    for (const item of obj.placed) {
      const p = parsePlaced(item);
      if (p) placed.push(p);
    }
  }
  const byType: Record<string, BarnModelRoomPlan> = {};
  if (obj.byType && typeof obj.byType === "object") {
    for (const [ty, plan] of Object.entries(
      obj.byType as Record<string, unknown>,
    )) {
      const p = parsePlan(plan);
      if (p) byType[ty] = p;
    }
  }
  const byBarn: Record<string, BarnModelBarnOverride> = {};
  if (obj.byBarn && typeof obj.byBarn === "object") {
    for (const [id, over] of Object.entries(
      obj.byBarn as Record<string, unknown>,
    )) {
      if (!over || typeof over !== "object") continue;
      const o = over as { plan?: unknown; slots?: unknown };
      const slots: Record<string, string> = {};
      if (o.slots && typeof o.slots === "object") {
        for (const [k, v] of Object.entries(
          o.slots as Record<string, unknown>,
        )) {
          if (typeof v === "string" && v.trim()) slots[k] = v.trim();
        }
      }
      const next: BarnModelBarnOverride = { slots };
      const plan = parsePlan(o.plan);
      if (plan) next.plan = plan;
      byBarn[id] = next;
    }
  }
  return { v: BARN_MODEL_PREFS_VERSION, placed, byType, byBarn };
}

const prefsListeners = new Set<() => void>();

export function subscribeBarnModelPrefs(onStoreChange: () => void): () => void {
  prefsListeners.add(onStoreChange);
  return () => {
    prefsListeners.delete(onStoreChange);
  };
}

function emitBarnModelPrefs(): void {
  for (const listener of prefsListeners) listener();
}

const emptyPrefsSingleton = emptyBarnModelPrefs();
let prefsSnapshot: {
  farmId: string;
  raw: string;
  prefs: BarnModelLayoutPrefs;
} | null = null;

export function loadBarnModelPrefs(farmId: string): BarnModelLayoutPrefs {
  if (typeof window === "undefined" || !farmId) return emptyPrefsSingleton;
  try {
    const raw =
      window.localStorage.getItem(barnModelPrefsStorageKey(farmId)) ?? "";
    if (
      prefsSnapshot &&
      prefsSnapshot.farmId === farmId &&
      prefsSnapshot.raw === raw
    ) {
      return prefsSnapshot.prefs;
    }
    const prefs = raw
      ? parseBarnModelPrefs(JSON.parse(raw))
      : emptyBarnModelPrefs();
    prefsSnapshot = { farmId, raw, prefs };
    return prefs;
  } catch {
    return emptyPrefsSingleton;
  }
}

export function saveBarnModelPrefs(
  farmId: string,
  prefs: BarnModelLayoutPrefs,
): void {
  if (typeof window === "undefined" || !farmId) return;
  window.localStorage.setItem(
    barnModelPrefsStorageKey(farmId),
    JSON.stringify(prefs),
  );
  emitBarnModelPrefs();
}

export function addPlacedBarn(
  prefs: BarnModelLayoutPrefs,
  input: {
    stallTyCode: string;
    stallNo?: string;
    plan: BarnModelRoomPlan;
    x?: number;
    z?: number;
  },
): BarnModelLayoutPrefs {
  const plan = clampPlan(input.plan, input.stallTyCode);
  const safePlan = planRoomCount(plan) > 0 ? plan : { left: 1, right: 0 };
  const n = prefs.placed.length;
  const stallNo =
    input.stallNo?.trim() ||
    String(n + 1).padStart(2, "0");
  const [x, z] = snapBarnFootprint(
    input.x ?? n * 15,
    input.z ?? 0,
    safePlan,
    input.stallTyCode,
    undefined,
    BARN_MODEL_SNAP_FINE_M,
  );
  const next: BarnModelPlacedBarn = {
    id: newPlacedId(),
    stallTyCode: input.stallTyCode,
    stallNo,
    x,
    z,
    rotDeg: 0,
    plan: safePlan,
  };
  return { ...prefs, placed: [...prefs.placed, next] };
}

export function movePlacedBarn(
  prefs: BarnModelLayoutPrefs,
  id: string,
  x: number,
  z: number,
): BarnModelLayoutPrefs {
  return {
    ...prefs,
    placed: prefs.placed.map((b) => {
      if (b.id !== id) return b;
      const shell = barnModelShell(b);
      const [sx, sz] = snapBarnFootprint(
        x,
        z,
        b.plan,
        b.stallTyCode,
        {
          width: shell.width,
          length: shell.length,
        },
        BARN_MODEL_SNAP_FINE_M,
      );
      return { ...b, x: sx, z: sz };
    }),
  };
}

export function rotatePlacedBarn(
  prefs: BarnModelLayoutPrefs,
  id: string,
  rotDeg: number,
): BarnModelLayoutPrefs {
  const snapped = snapBarnRotDeg(rotDeg);
  return {
    ...prefs,
    placed: prefs.placed.map((b) =>
      b.id === id ? { ...b, rotDeg: snapped } : b,
    ),
  };
}

export function renamePlacedBarn(
  prefs: BarnModelLayoutPrefs,
  id: string,
  name: string,
): BarnModelLayoutPrefs {
  const trimmed = name.trim().slice(0, 24);
  return {
    ...prefs,
    placed: prefs.placed.map((b) => {
      if (b.id !== id) return b;
      if (!trimmed) {
        const next = { ...b };
        delete next.name;
        return next;
      }
      return { ...b, name: trimmed };
    }),
  };
}

/** 치수선 숫자 입력. 길이는 입구를 고정하고 뒤로 늘어난다. */
export function updatePlacedShell(
  prefs: BarnModelLayoutPrefs,
  id: string,
  axis: BarnModelDimAxis,
  meters: number,
): BarnModelLayoutPrefs {
  const clamped = clampBarnDimMeters(axis, meters);
  if (clamped == null) return prefs;
  return {
    ...prefs,
    placed: prefs.placed.map((b) => {
      if (b.id !== id) return b;
      const oldShell = barnModelShell(b);
      const next: BarnModelPlacedBarn = { ...b };
      if (axis === "length") next.lengthM = clamped;
      else if (axis === "width") next.widthM = clamped;
      else next.wallHM = clamped;
      if (axis === "height") return next;
      const newShell = barnModelShell(next);
      const dL =
        axis === "length" ? (oldShell.length - newShell.length) / 2 : 0;
      const [dx, dz] = rotateXZ(0, dL, b.rotDeg);
      return {
        ...next,
        x: roundMm(b.x + dx),
        z: roundMm(b.z + dz),
      };
    }),
  };
}

export type BarnModelFillPatch = {
  penAlong?: number;
  penDepth?: number;
  aisleW?: number;
  banks?: BarnModelBanks;
  roomCount?: number;
};

/** 방 치수·복도 열·칸 수. 길·폭은 계산되고 입구는 고정. */
export function updatePlacedFill(
  prefs: BarnModelLayoutPrefs,
  id: string,
  patch: BarnModelFillPatch,
): BarnModelLayoutPrefs {
  return {
    ...prefs,
    placed: prefs.placed.map((b) => {
      if (b.id !== id) return b;
      const prev = barnModelFill(b);
      const penAlong =
        patch.penAlong == null
          ? prev.penAlong
          : clampBarnPenAlongM(patch.penAlong);
      const penDepth =
        patch.penDepth == null
          ? prev.penDepth
          : clampBarnPenDepthM(patch.penDepth);
      const aisleW =
        patch.aisleW == null ? prev.aisleW : clampBarnAisleW(patch.aisleW);
      const banks = patch.banks == null ? prev.banks : clampBarnBanks(patch.banks);
      const roomCount = Math.max(
        1,
        clampRoomCount(
          patch.roomCount == null ? prev.roomCount : patch.roomCount,
          b.stallTyCode,
          penAlong,
        ) || 1,
      );
      const plan = planFromFill(banks, roomCount);
      const oldShell = barnModelShell(b);
      const next: BarnModelPlacedBarn = {
        ...b,
        plan,
        banks,
        penAlongM: penAlong,
        penDepthM: penDepth,
        aisleWM: aisleW,
      };
      delete next.lengthM;
      delete next.widthM;
      const newShell = barnModelShell(next);
      const dL = (oldShell.length - newShell.length) / 2;
      const [dx, dz] = rotateXZ(0, dL, b.rotDeg);
      return {
        ...next,
        x: roundMm(b.x + dx),
        z: roundMm(b.z + dz),
      };
    }),
  };
}

export function clonePlacedBarn(b: BarnModelPlacedBarn): BarnModelPlacedBarn {
  return { ...b, plan: { ...b.plan } };
}

export function restorePlacedBarn(
  prefs: BarnModelLayoutPrefs,
  barn: BarnModelPlacedBarn,
): BarnModelLayoutPrefs {
  return {
    ...prefs,
    placed: prefs.placed.map((b) =>
      b.id === barn.id ? clonePlacedBarn(barn) : b,
    ),
  };
}

/** 방 편집 세션 — 치수·칸·위치가 같은지. */
export function placedFillSessionEqual(
  a: BarnModelPlacedBarn,
  b: BarnModelPlacedBarn,
): boolean {
  const fa = barnModelFill(a);
  const fb = barnModelFill(b);
  return (
    fa.penAlong === fb.penAlong &&
    fa.penDepth === fb.penDepth &&
    fa.aisleW === fb.aisleW &&
    fa.banks === fb.banks &&
    fa.roomCount === fb.roomCount &&
    a.x === b.x &&
    a.z === b.z
  );
}

export function removePlacedBarn(
  prefs: BarnModelLayoutPrefs,
  id: string,
): BarnModelLayoutPrefs {
  const byBarn = { ...prefs.byBarn };
  delete byBarn[id];
  return {
    ...prefs,
    placed: prefs.placed.filter((b) => b.id !== id),
    byBarn,
  };
}
