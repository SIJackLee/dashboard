import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import type { BarnMapSnapshot, BarnReading, ControllerStatus } from "@/lib/data/iot";
import { compareReadings, compareStallNo } from "@/lib/data/reading-hierarchy";
import {
  getStallTypeName,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import {
  BARN_MODEL_ROOM_MAX,
  clampRoomCount,
  emptyBarnModelPrefs,
  slotKey,
  type BarnModelLayoutPrefs,
  type BarnModelPlacedBarn,
  type BarnModelRoomPlan,
} from "@/lib/farm/barn-model-prefs";
import {
  BARN_MODEL_DIM,
  barnModelAisleX,
  barnModelLength,
  barnModelTypeSpec,
  barnModelWidth,
} from "@/lib/farm/barn-model-dim";

export type { BarnModelRoomPlan };
export { BARN_MODEL_DIM };

export type BarnModelPenSide = "left" | "right";

export type BarnModelPen = {
  id: string;
  side: BarnModelPenSide;
  index: number;
  status: ControllerStatus | "empty";
  controllerKey: string | null;
  label: string;
  localPos: [number, number, number];
  gatePos: [number, number, number];
  size: [number, number];
};

export type BarnModelBuilding = {
  id: string;
  label: string;
  stallTyCode: string;
  stallNo: string;
  origin: [number, number, number];
  rotDeg: number;
  width: number;
  length: number;
  status: ControllerStatus;
  /** 유형 LIVE 중 대표(가장 나쁜 상태). 방 단위 매핑 없음. */
  controllerKey: string | null;
  tempC: number | null;
  humidityPct: number | null;
  plan: BarnModelRoomPlan;
  pens: BarnModelPen[];
};

export type BarnModelYard = {
  barns: BarnModelBuilding[];
  center: [number, number, number];
};

export type BarnModelCameraShot = "roof" | "entrance";

const STATUS_RANK: Record<ControllerStatus, number> = {
  normal: 0,
  caution: 1,
  offline: 2,
};

export function worstControllerStatus(
  statuses: ControllerStatus[],
): ControllerStatus {
  if (statuses.length === 0) return "offline";
  return statuses.reduce((w, s) =>
    STATUS_RANK[s] > STATUS_RANK[w] ? s : w,
  );
}

export function barnModelStatusLabel(
  status: ControllerStatus | "empty",
): string {
  if (status === "caution") return "주의";
  if (status === "offline" || status === "empty") return "오프라인";
  return "정상";
}

/** 지붕 표기: 축사유형-번호-현황 */
export function barnModelRoofTitle(
  stallTyCode: string,
  stallNo: string,
  status: ControllerStatus | "empty",
): string {
  const ty = getStallTypeName(stallTyCode);
  const no = stallNo.trim() || "01";
  return `${ty}-${no}-${barnModelStatusLabel(status)}`;
}

export function barnModelStatusHex(
  status: ControllerStatus | "empty",
): string {
  if (status === "empty") return "#cbd5e1";
  if (status === "caution") return "#f59e0b";
  if (status === "offline") return "#94a3b8";
  return "#34d399";
}

export function barnModelLabel(barn: BarnMapSnapshot): string {
  const entry = parseBarnCatalogKey(barn.meta.id);
  const tyName = getStallTypeName(entry?.stallTyCode ?? barn.meta.name);
  const stallNo = barn.meta.stallNo?.trim() ?? "";
  return stallNo ? `${tyName} ${stallNo}` : tyName;
}

const DEFAULT_TYPE_PLAN: Record<string, BarnModelRoomPlan> = {
  SP02: { left: 8, right: 8 },
  SP03: { left: 3, right: 3 },
  SP05: { left: 3, right: 3 },
  SP06: { left: 3, right: 3 },
  SP07: { left: 4, right: 4 },
};

export function defaultBarnModelPlan(stallTyCode: string): BarnModelRoomPlan {
  return DEFAULT_TYPE_PLAN[normalizeStallTyCode(stallTyCode)] ?? {
    left: 3,
    right: 3,
  };
}

/** 유형+번호 대조. `1`과 `01`은 같은 축사. */
export function barnModelStallKey(stallTyCode: string, stallNo: string): string {
  const ty = normalizeStallTyCode(stallTyCode);
  const raw = stallNo.trim();
  if (!raw || raw.startsWith("__")) return `${ty}:`;
  const n = Number(raw);
  const no = Number.isFinite(n) ? String(n) : raw;
  return `${ty}:${no}`;
}

export type BarnModelFarmSlot = {
  stallTyCode: string;
  stallNo: string;
  plan: BarnModelRoomPlan;
  label: string;
};

/** 이 농장 LIVE 축사(유형+번호). 현장 카드·판독에서 모은다. */
export function barnModelFarmSlots(
  barns: BarnMapSnapshot[],
  readings: BarnReading[],
): BarnModelFarmSlot[] {
  const map = new Map<string, BarnModelFarmSlot>();
  const add = (stallTyCode: string, stallNo: string) => {
    const ty = normalizeStallTyCode(stallTyCode);
    const no = stallNo.trim();
    if (!ty || ty === "UNK") return;
    if (!no || no.startsWith("__")) return;
    const key = barnModelStallKey(ty, no);
    if (map.has(key)) return;
    map.set(key, {
      stallTyCode: ty,
      stallNo: no,
      plan: defaultBarnModelPlan(ty),
      label: `${getStallTypeName(ty)} ${no}`,
    });
  };
  for (const barn of barns) {
    const entry = parseBarnCatalogKey(barn.meta.id);
    add(entry?.stallTyCode ?? "", barn.meta.stallNo ?? "");
  }
  for (const r of readings) {
    add(r.stallTyCode ?? "", r.stallNo ?? "");
  }
  return [...map.values()].sort((a, b) => {
    const tc =
      stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
    if (tc !== 0) return tc;
    return compareStallNo(a.stallNo, b.stallNo);
  });
}

export function isBarnSlotPlaced(
  stallTyCode: string,
  stallNo: string,
  placed: Pick<BarnModelPlacedBarn, "stallTyCode" | "stallNo">[],
): boolean {
  const key = barnModelStallKey(stallTyCode, stallNo);
  return placed.some(
    (p) => barnModelStallKey(p.stallTyCode, p.stallNo) === key,
  );
}

export function nextCustomStallNo(
  stallTyCode: string,
  used: Pick<BarnModelPlacedBarn, "stallTyCode" | "stallNo">[],
): string {
  const ty = normalizeStallTyCode(stallTyCode);
  const taken = new Set<number>();
  for (const s of used) {
    if (normalizeStallTyCode(s.stallTyCode) !== ty) continue;
    const n = Number(s.stallNo.trim());
    if (Number.isFinite(n)) taken.add(n);
  }
  let i = 1;
  while (taken.has(i)) i += 1;
  return String(i).padStart(2, "0");
}

export function placedBarnLabel(placed: BarnModelPlacedBarn): string {
  const custom = placed.name?.trim();
  if (custom) return custom;
  const tyName = getStallTypeName(placed.stallTyCode);
  const stallNo = placed.stallNo.trim();
  return stallNo ? `${tyName} ${stallNo}` : tyName;
}

export function readingsForBarnModel(
  barn: BarnMapSnapshot,
  readings: BarnReading[],
): BarnReading[] {
  const entry = parseBarnCatalogKey(barn.meta.id);
  const stallTy = normalizeStallTyCode(entry?.stallTyCode ?? "");
  const stallNo = barn.meta.stallNo ?? "";
  return readings.filter(
    (r) =>
      normalizeStallTyCode(r.stallTyCode ?? "") === stallTy &&
      (r.stallNo ?? "") === stallNo,
  );
}

export function readingsForPlacedBarn(
  placed: Pick<BarnModelPlacedBarn, "stallTyCode" | "stallNo">,
  readings: BarnReading[],
): BarnReading[] {
  return readingsForStallType(placed.stallTyCode, readings);
}

/** 컨트롤러는 축사 유형 단위. 방·동 번호로 나누지 않는다. */
export function readingsForStallType(
  stallTyCode: string,
  readings: BarnReading[],
): BarnReading[] {
  const stallTy = normalizeStallTyCode(stallTyCode);
  return readings
    .filter((r) => normalizeStallTyCode(r.stallTyCode ?? "") === stallTy)
    .sort(compareReadings);
}

export function primaryReadingForType(
  readings: BarnReading[],
): BarnReading | null {
  if (readings.length === 0) return null;
  const worst = worstControllerStatus(readings.map((r) => r.status));
  const ranked = [...readings].sort(compareReadings);
  return ranked.find((r) => r.status === worst) ?? ranked[0] ?? null;
}

export const BARN_CTRL_W = 0.88;
export const BARN_CTRL_H = 0.62;
export const BARN_CTRL_GAP_X = 0.2;
export const BARN_CTRL_GAP_Y = 0.18;
export const BARN_CTRL_COLS = 2;

export type BarnControllerMount = {
  controllerKey: string;
  eqpmnNo: string;
  status: ControllerStatus;
  tempC: number | null;
  position: [number, number, number];
  rotY: number;
};

function uniqueTypeReadings(readings: BarnReading[]): BarnReading[] {
  const seen = new Set<string>();
  const out: BarnReading[] = [];
  for (const r of [...readings].sort(compareReadings)) {
    if (!r.controllerKey || seen.has(r.controllerKey)) continue;
    seen.add(r.controllerKey);
    out.push(r);
  }
  return out.sort((a, b) => {
    const eq = normalizeEqpmnNo(a.eqpmnNo).localeCompare(
      normalizeEqpmnNo(b.eqpmnNo),
      "ko",
      { numeric: true },
    );
    if (eq !== 0) return eq;
    return compareStallNo(a.stallNo, b.stallNo);
  });
}

function frontWallGrid(
  count: number,
  dims: { width: number; length: number; aisleX: number; aisleW: number },
  side: "left" | "right",
  tileW: number,
  tileH: number,
): { position: [number, number, number]; rotY: number }[] {
  if (count <= 0) return [];
  const { width, length, aisleX, aisleW } = dims;
  const aisleLeft = aisleX - aisleW / 2;
  const aisleRight = aisleX + aisleW / 2;
  const face = 0.07;
  const pad = 0.16;
  const half = tileW / 2;
  const xMin =
    side === "left" ? -width / 2 + pad + half : aisleRight + pad + half;
  const xMax =
    side === "left" ? aisleLeft - pad - half : width / 2 - pad - half;
  const cols =
    xMax - xMin >= tileW + BARN_CTRL_GAP_X - 0.01 ? BARN_CTRL_COLS : 1;
  const pitchX = tileW + BARN_CTRL_GAP_X;
  const midX = (xMin + Math.max(xMax, xMin)) / 2;
  const firstX = midX - ((cols - 1) * pitchX) / 2;
  const xs = Array.from({ length: cols }, (_, c) => firstX + c * pitchX);
  const rows = Math.ceil(count / cols);
  const yTop = BARN_MODEL_DIM.wallH - pad - tileH / 2;
  const yBot = 1.08;
  const pitchY = tileH + BARN_CTRL_GAP_Y;
  const packH = (rows - 1) * pitchY;
  const fits = rows <= 1 || yTop - packH >= yBot - 0.01;
  const yStep = rows <= 1 ? 0 : fits ? pitchY : (yTop - yBot) / (rows - 1);
  const yFirst = fits ? Math.min(yTop, (yTop + yBot + packH) / 2) : yTop;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      position: [xs[col] ?? xs[0]!, yFirst - row * yStep, length / 2 + face],
      rotY: 0,
    };
  });
}

function mountsFromReadings(
  readings: BarnReading[],
  slots: { position: [number, number, number]; rotY: number }[],
): BarnControllerMount[] {
  const unique = uniqueTypeReadings(readings);
  return unique.slice(0, slots.length).map((r, i) => ({
    controllerKey: r.controllerKey,
    eqpmnNo: normalizeEqpmnNo(r.eqpmnNo ?? String(i + 1).padStart(2, "0")),
    status: r.status,
    tempC: r.tempC,
    position: slots[i]!.position,
    rotY: slots[i]!.rotY,
  }));
}

/** 유형 LIVE 컨트롤러를 입구 왼쪽 벽에 2열 그리드로 배치. 묶음은 벽면 중앙, 왼쪽 위=01. */
export function mountBarnControllers(
  readings: BarnReading[],
  dims: { width: number; length: number; aisleX: number; aisleW: number },
): BarnControllerMount[] {
  const unique = uniqueTypeReadings(readings);
  return mountsFromReadings(
    unique,
    frontWallGrid(unique.length, dims, "left", BARN_CTRL_W, BARN_CTRL_H),
  );
}

export type BarnModelNavBarn = Pick<
  BarnModelPlacedBarn,
  "id" | "stallTyCode" | "stallNo"
>;

export function sortPlacedBarnsForNav<T extends BarnModelNavBarn>(
  placed: T[],
): T[] {
  return [...placed].sort((a, b) => {
    const tc =
      stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
    if (tc !== 0) return tc;
    return compareStallNo(a.stallNo, b.stallNo);
  });
}

function cycleListItem<T>(items: T[], current: T, dir: 1 | -1): T | null {
  if (items.length === 0) return null;
  const i = items.indexOf(current);
  if (i < 0) return items[0] ?? null;
  return items[(i + dir + items.length) % items.length] ?? null;
}

export function cyclePlacedBarnId(
  placed: BarnModelNavBarn[],
  currentId: string,
  dir: 1 | -1,
): string | null {
  return cycleListItem(
    sortPlacedBarnsForNav(placed).map((b) => b.id),
    currentId,
    dir,
  );
}

export function cycleSameTypeBarnId(
  placed: BarnModelNavBarn[],
  currentId: string,
  dir: 1 | -1,
): string | null {
  const current = placed.find((b) => b.id === currentId);
  if (!current) return cyclePlacedBarnId(placed, currentId, dir);
  const ty = normalizeStallTyCode(current.stallTyCode);
  const same = sortPlacedBarnsForNav(placed).filter(
    (b) => normalizeStallTyCode(b.stallTyCode) === ty,
  );
  return cycleListItem(
    same.map((b) => b.id),
    currentId,
    dir,
  );
}

export function findPlacedBarnId(
  placed: BarnModelNavBarn[],
  stallTyCode: string,
  stallNo: string,
): string | null {
  const key = barnModelStallKey(stallTyCode, stallNo);
  return (
    placed.find((b) => barnModelStallKey(b.stallTyCode, b.stallNo) === key)
      ?.id ?? null
  );
}

export function typeControllerCount(readings: BarnReading[]): number {
  return uniqueTypeReadings(readings).length;
}

export function cycleTypeControllerKey(
  readings: BarnReading[],
  currentKey: string | null,
  dir: 1 | -1,
): string | null {
  const keys = uniqueTypeReadings(readings).map((r) => r.controllerKey);
  if (keys.length === 0) return null;
  if (!currentKey) return keys[0] ?? null;
  return cycleListItem(keys, currentKey, dir);
}

export function barnLengthFromPlan(
  plan: BarnModelRoomPlan,
  stallTyCode = "",
): number {
  return barnModelLength(stallTyCode, plan);
}

export function rowsFromDragLength(
  length: number,
  stallTyCode = "",
): number {
  const spec = barnModelTypeSpec(stallTyCode);
  const rows = Math.round(
    (Math.max(length, spec.penAlong) - spec.endPad) / spec.penAlong,
  );
  return Math.max(1, Math.min(BARN_MODEL_ROOM_MAX, rows));
}

/** 길이 핸들 — 방이 있는 쪽만 칸 수를 맞춤. */
export function planFromRowDrag(
  prev: BarnModelRoomPlan,
  rows: number,
): BarnModelRoomPlan {
  const r = Math.max(1, clampRoomCount(rows) || 1);
  const leftOn = prev.left > 0;
  const rightOn = prev.right > 0;
  if (leftOn && rightOn) return { left: r, right: r };
  if (rightOn && !leftOn) return { left: 0, right: r };
  return { left: r, right: 0 };
}

export function planFromSideDrag(
  prev: BarnModelRoomPlan,
  side: "left" | "right",
  rows: number,
): BarnModelRoomPlan {
  const r = clampRoomCount(rows);
  return side === "left" ? { ...prev, left: r } : { ...prev, right: r };
}

/** 방 줄 끝 핸들. dAlong > 0 이면 뒤쪽으로 칸이 늘어난다. */
export function planFromSideHandleDelta(
  prev: BarnModelRoomPlan,
  side: "left" | "right",
  dAlong: number,
  stallTyCode = "",
): BarnModelRoomPlan {
  const spec = barnModelTypeSpec(stallTyCode);
  const start = side === "left" ? prev.left : prev.right;
  const rows = start + Math.round(dAlong / spec.penAlong);
  const next = planFromSideDrag(prev, side, rows);
  if (next.left + next.right === 0) return prev;
  return next;
}

/** 한쪽 방 수를 ±1. 전체 방이 0이 되면 그대로 둔다. */
export function nudgePlanSide(
  prev: BarnModelRoomPlan,
  side: "left" | "right",
  delta: 1 | -1,
): BarnModelRoomPlan {
  const cur = side === "left" ? prev.left : prev.right;
  const next = planFromSideDrag(prev, side, cur + delta);
  if (next.left + next.right === 0) return prev;
  return next;
}

export function ghostBuildingFromPlan(
  plan: BarnModelRoomPlan,
  label: string,
  origin: [number, number, number],
  rotDeg = 0,
  stallTyCode = "",
): BarnModelBuilding {
  const length = barnModelLength(stallTyCode, plan);
  const width = barnModelWidth(stallTyCode, plan);
  return {
    id: "__ghost__",
    label,
    stallTyCode,
    stallNo: "",
    origin,
    rotDeg,
    width,
    length,
    status: "normal",
    tempC: null,
    humidityPct: null,
    controllerKey: null,
    plan,
    pens: assignPensFromReadings([], plan, undefined, length, false, stallTyCode),
  };
}

function penLocalPos(
  side: BarnModelPenSide,
  index: number,
  plan: BarnModelRoomPlan,
  length: number,
  stallTyCode: string,
): {
  localPos: [number, number, number];
  gatePos: [number, number, number];
  size: [number, number];
} {
  const { aisleW, wallH } = BARN_MODEL_DIM;
  const spec = barnModelTypeSpec(stallTyCode);
  const width = barnModelWidth(stallTyCode, plan);
  const aisleX = barnModelAisleX(plan, width);
  const rows = Math.max(plan.left, plan.right, 1);
  const penLen = (length - spec.endPad * 0.24) / rows;
  const z = length / 2 - penLen * (index + 0.5);
  const xSign = side === "left" ? -1 : 1;
  const x = aisleX + xSign * (aisleW / 2 + spec.penDepth / 2);
  const gateX = aisleX + xSign * (aisleW / 2 + 0.28);
  return {
    localPos: [x, 0.05, z],
    gatePos: [gateX, wallH * 0.38, z],
    size: [spec.penDepth - 0.12, Math.max(penLen - 0.08, 0.2)],
  };
}

export function listPlanSlots(
  plan: BarnModelRoomPlan,
): { side: BarnModelPenSide; index: number; id: string }[] {
  const slots: { side: BarnModelPenSide; index: number; id: string }[] = [];
  const rows = Math.max(plan.left, plan.right);
  for (let i = 0; i < rows; i += 1) {
    if (i < plan.left) {
      slots.push({ side: "left", index: i, id: slotKey("left", i) });
    }
    if (i < plan.right) {
      slots.push({ side: "right", index: i, id: slotKey("right", i) });
    }
  }
  return slots;
}

/** 저장된 슬롯이 있으면 그대로. 없으면 입구부터 좌·우 교차 자동 배치. */
export function assignPensFromReadings(
  readings: BarnReading[],
  plan: BarnModelRoomPlan,
  slots?: Record<string, string>,
  length = barnModelLength("", plan),
  autoFill = false,
  stallTyCode = "",
): BarnModelPen[] {
  const sorted = [...readings].sort(compareReadings);
  const byKey = new Map(sorted.map((r) => [r.controllerKey, r]));
  const hasSaved = Boolean(slots && Object.keys(slots).length > 0);
  const order = listPlanSlots(plan);
  const auto = sorted.filter((r) => r.controllerKey);

  return order.map((slot, orderIdx) => {
    const savedKey = slots?.[slot.id];
    let reading = savedKey ? byKey.get(savedKey) : undefined;
    if (!hasSaved && autoFill && !reading) {
      reading = auto[orderIdx];
    }
    const pos = penLocalPos(slot.side, slot.index, plan, length, stallTyCode);
    return {
      id: slot.id,
      side: slot.side,
      index: slot.index,
      status: reading?.status ?? "empty",
      controllerKey: reading?.controllerKey ?? null,
      label:
        reading?.label ?? `${slot.side === "left" ? "좌" : "우"} ${slot.index + 1}`,
      ...pos,
    };
  });
}

export function unassignedReadings(
  readings: BarnReading[],
  pens: BarnModelPen[],
): BarnReading[] {
  const used = new Set(
    pens.map((p) => p.controllerKey).filter((k): k is string => Boolean(k)),
  );
  return [...readings]
    .sort(compareReadings)
    .filter((r) => !used.has(r.controllerKey));
}

export function rotateY(
  x: number,
  z: number,
  rotDeg: number,
): [number, number] {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - z * s, x * s + z * c];
}

export function buildBarnModelYard(
  readings: BarnReading[],
  prefs: BarnModelLayoutPrefs = emptyBarnModelPrefs(),
): BarnModelYard {
  const buildings: BarnModelBuilding[] = prefs.placed.map((placed) => {
    const matched = readingsForPlacedBarn(placed, readings);
    const plan = placed.plan;
    const ty = normalizeStallTyCode(placed.stallTyCode);
    const length = barnModelLength(ty, plan);
    const width = barnModelWidth(ty, plan);
    const statuses = matched.map((r) => r.status);
    const status = worstControllerStatus(statuses);
    const primary = primaryReadingForType(matched);
    const pens = assignPensFromReadings(
      matched,
      plan,
      undefined,
      length,
      false,
      ty,
    ).map((pen) => ({
      ...pen,
      status: matched.length > 0 ? status : "empty",
      controllerKey: null,
    }));
    return {
      id: placed.id,
      label: placedBarnLabel(placed),
      stallTyCode: ty,
      stallNo: placed.stallNo.trim(),
      origin: [placed.x, 0, placed.z],
      rotDeg: placed.rotDeg,
      width,
      length,
      status,
      controllerKey: primary?.controllerKey ?? null,
      tempC: primary?.tempC ?? null,
      humidityPct: primary?.humidityPct ?? null,
      plan,
      pens,
    };
  });
  if (buildings.length === 0) {
    return { barns: [], center: [0, 0, 0] };
  }
  const xs = buildings.map((b) => b.origin[0]);
  const zs = buildings.map((b) => b.origin[2]);
  return {
    barns: buildings,
    center: [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      0,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    ],
  };
}

/** 필드 카메라 — 거의 수직. 높이 비율을 MapControls polar과 맞춤. */
const ROOF_POLAR_RUN = 1.6;
const ROOF_POLAR_RISE = 62;

export function barnModelYardBounds(yard: Pick<BarnModelYard, "barns">): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  span: number;
} {
  if (yard.barns.length === 0) {
    return { minX: -16, maxX: 16, minZ: -16, maxZ: 16, span: 32 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const barn of yard.barns) {
    const hw = barn.width / 2;
    const hl = barn.length / 2;
    for (const [lx, lz] of [
      [-hw, -hl],
      [hw, -hl],
      [-hw, hl],
      [hw, hl],
    ] as const) {
      const [x, z] = rotateY(lx, lz, barn.rotDeg);
      const wx = barn.origin[0] + x;
      const wz = barn.origin[2] + z;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 10);
  return { minX, maxX, minZ, maxZ, span };
}

/** 놓은 동 묶음이 화면에 차도록. */
export function barnModelRoofHeight(span: number): number {
  const s = Number.isFinite(span) ? span : 32;
  return Math.round(Math.min(42, Math.max(14, s / 0.78 + 4)) * 10) / 10;
}

/** 필드 격자 — 작업 범위만. 5m 굵은 선이 맞게 10m 단위. */
export function barnModelYardGridSize(span: number): number {
  const s = Number.isFinite(span) ? span : 32;
  return Math.ceil(Math.max(40, Math.min(100, s + 28)) / 10) * 10;
}

/** 입구 카메라 — 동 폭이 넓을수록 뒤로. 문·좌측 컨트롤러·우측 카드가 한 프레임. */
export function barnModelEntranceStandOff(width: number): number {
  const w = Number.isFinite(width) ? width : 6.6;
  return Math.round(Math.min(11.2, Math.max(6.6, 4.2 + w * 0.48)) * 10) / 10;
}

/** 입구 상단 벽 카드 스케일. 좁은 동은 벽을 덮지 않게 줄인다. */
export function barnModelEntranceCardScale(width: number): number {
  const w = Number.isFinite(width) ? width : 6.6;
  if (w < 8) return 0.26;
  if (w < 12) return 0.3;
  return 0.32;
}

/** 편집 카메라 — 그 동만 화면 가운데, 회전 고리까지 보이게. */
export function barnModelEditCameraPose(barn: {
  origin: [number, number, number];
  width: number;
  length: number;
}): { position: [number, number, number]; lookAt: [number, number, number] } {
  const [cx, , cz] = barn.origin;
  const span = Math.max(barn.width, barn.length, 8) + 10;
  const h = barnModelRoofHeight(span);
  const zOff = h * (ROOF_POLAR_RUN / ROOF_POLAR_RISE);
  return {
    position: [cx, h, cz + zOff],
    lookAt: [cx, 0, cz],
  };
}

export function barnModelCameraPose(
  shot: BarnModelCameraShot,
  yard: BarnModelYard,
  selectedBarnId: string | null,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  if (shot === "entrance" && selectedBarnId) {
    const barn = yard.barns.find((b) => b.id === selectedBarnId);
    if (barn) {
      const [ox, , oz] = barn.origin;
      const stand = barnModelEntranceStandOff(barn.width);
      const [dx, dz] = rotateY(0, barn.length / 2 + stand, barn.rotDeg);
      const [lx, lz] = rotateY(0, barn.length / 2, barn.rotDeg);
      return {
        position: [ox + dx, 1.68, oz + dz],
        lookAt: [ox + lx, 1.48, oz + lz],
      };
    }
  }
  const [cx, , cz] = yard.center;
  const { span } = barnModelYardBounds(yard);
  const h = barnModelRoofHeight(span);
  const zOff = h * (ROOF_POLAR_RUN / ROOF_POLAR_RISE);
  return {
    position: [cx, h, cz + zOff],
    lookAt: [cx, 0, cz],
  };
}

