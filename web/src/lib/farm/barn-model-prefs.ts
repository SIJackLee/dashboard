/** 모델 탭 배치 — 로컬만 (DB 없음). 빈 필드에서 사용자가 축사를 놓는다. */

import { barnModelLength, barnModelWidth } from "@/lib/farm/barn-model-dim";

export const BARN_MODEL_PREFS_VERSION = 2;
export const BARN_MODEL_ROOM_MAX = 8;
/** 필드 격자 한 칸(160m / 32)과 같은 5m. */
export const BARN_MODEL_SNAP_M = 5;
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

export function snapBarnXZ(x: number, z: number): [number, number] {
  const s = BARN_MODEL_SNAP_M;
  return [roundMm(Math.round(x / s) * s), roundMm(Math.round(z / s) * s)];
}

export function snapBarnRotDeg(deg: number): number {
  const s = BARN_MODEL_SNAP_DEG;
  const wrapped = ((deg % 360) + 360) % 360;
  const snapped = Math.round(wrapped / s) * s;
  return snapped === 360 ? 0 : snapped;
}

export function footprintLength(
  plan: BarnModelRoomPlan,
  stallTyCode = "",
): number {
  return barnModelLength(stallTyCode, plan);
}

/** 축사 뒤·왼쪽 모서리를 5m 격자에 붙인 뒤 중심으로 환산. */
export function snapBarnFootprint(
  x: number,
  z: number,
  plan: BarnModelRoomPlan,
  stallTyCode = "",
): [number, number] {
  const s = BARN_MODEL_SNAP_M;
  const halfW = barnModelWidth(stallTyCode, plan) / 2;
  const halfL = barnModelLength(stallTyCode, plan) / 2;
  const minX = Math.round((x - halfW) / s) * s;
  const minZ = Math.round((z - halfL) / s) * s;
  return [roundMm(minX + halfW), roundMm(minZ + halfL)];
}

export type BarnModelRoomPlan = {
  left: number;
  right: number;
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

export function clampRoomCount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(BARN_MODEL_ROOM_MAX, Math.round(n)));
}

export function clampPlan(plan: BarnModelRoomPlan): BarnModelRoomPlan {
  return {
    left: clampRoomCount(plan.left),
    right: clampRoomCount(plan.right),
  };
}

export function planRoomCount(plan: BarnModelRoomPlan): number {
  return plan.left + plan.right;
}

export function defaultPlanFromCount(controllerCount: number): BarnModelRoomPlan {
  const n = clampRoomCount(controllerCount);
  return { left: Math.ceil(n / 2), right: Math.floor(n / 2) };
}

export function slotKey(
  side: "left" | "right",
  index: number,
): string {
  return `${side}-${index}`;
}

function newPlacedId(): string {
  return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parsePlan(raw: unknown): BarnModelRoomPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { left?: unknown; right?: unknown };
  return clampPlan({
    left: Number(p.left) || 0,
    right: Number(p.right) || 0,
  });
}

function parsePlaced(raw: unknown): BarnModelPlacedBarn | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const stallTyCode = typeof o.stallTyCode === "string" ? o.stallTyCode : "";
  if (!id || !stallTyCode) return null;
  const plan = parsePlan(o.plan) ?? { left: 3, right: 3 };
  if (planRoomCount(plan) === 0) plan.left = 1;
  const [x, z] = snapBarnFootprint(
    Number(o.x) || 0,
    Number(o.z) || 0,
    plan,
    stallTyCode,
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
  const plan = clampPlan(input.plan);
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
      const [sx, sz] = snapBarnFootprint(x, z, b.plan, b.stallTyCode);
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

export function updatePlacedPlan(
  prefs: BarnModelLayoutPrefs,
  id: string,
  plan: BarnModelRoomPlan,
  opts?: { pin?: "front" | "back" },
): BarnModelLayoutPrefs {
  const next = clampPlan(plan);
  const safe = planRoomCount(next) > 0 ? next : { left: 1, right: 0 };
  return {
    ...prefs,
    placed: prefs.placed.map((b) => {
      if (b.id !== id) return b;
      if (!opts?.pin) return { ...b, plan: safe };
      const oldW = barnModelWidth(b.stallTyCode, b.plan);
      const oldL = barnModelLength(b.stallTyCode, b.plan);
      const newW = barnModelWidth(b.stallTyCode, safe);
      const newL = barnModelLength(b.stallTyCode, safe);
      const dL =
        opts.pin === "front" ? (oldL - newL) / 2 : (newL - oldL) / 2;
      const [dx, dz] = rotateXZ((newW - oldW) / 2, dL, b.rotDeg);
      return {
        ...b,
        plan: safe,
        x: roundMm(b.x + dx),
        z: roundMm(b.z + dz),
      };
    }),
  };
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

export function resolveBarnPlan(
  stallTyCode: string,
  barnId: string,
  controllerCount: number,
  prefs: BarnModelLayoutPrefs,
): BarnModelRoomPlan {
  const placed = prefs.placed.find((b) => b.id === barnId);
  if (placed && planRoomCount(placed.plan) > 0) return clampPlan(placed.plan);
  const barnPlan = prefs.byBarn[barnId]?.plan;
  if (barnPlan && planRoomCount(barnPlan) > 0) return clampPlan(barnPlan);
  const typePlan = prefs.byType[stallTyCode];
  if (typePlan && planRoomCount(typePlan) > 0) return clampPlan(typePlan);
  return defaultPlanFromCount(controllerCount);
}

export function setTypePlan(
  prefs: BarnModelLayoutPrefs,
  stallTyCode: string,
  plan: BarnModelRoomPlan,
): BarnModelLayoutPrefs {
  return {
    ...prefs,
    byType: { ...prefs.byType, [stallTyCode]: clampPlan(plan) },
  };
}

export function setBarnSlot(
  prefs: BarnModelLayoutPrefs,
  barnId: string,
  key: string,
  controllerKey: string | null,
): BarnModelLayoutPrefs {
  const prev = prefs.byBarn[barnId] ?? { slots: {} };
  const slots = { ...prev.slots };
  if (!controllerKey) delete slots[key];
  else {
    for (const [k, v] of Object.entries(slots)) {
      if (v === controllerKey && k !== key) delete slots[k];
    }
    slots[key] = controllerKey;
  }
  return {
    ...prefs,
    byBarn: { ...prefs.byBarn, [barnId]: { ...prev, slots } },
  };
}

export function clearBarnSlots(
  prefs: BarnModelLayoutPrefs,
  barnId: string,
): BarnModelLayoutPrefs {
  const prev = prefs.byBarn[barnId];
  if (!prev) return prefs;
  return {
    ...prefs,
    byBarn: { ...prefs.byBarn, [barnId]: { ...prev, slots: {} } },
  };
}
