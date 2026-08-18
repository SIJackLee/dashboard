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
  emptyBarnModelPrefs,
  slotKey,
  type BarnModelLayoutPrefs,
  type BarnModelPlacedBarn,
  type BarnModelRoomPlan,
} from "@/lib/farm/barn-model-prefs";
import {
  BARN_MODEL_DIM,
  barnModelAisleCenters,
  barnModelBankCenters,
  barnModelFill,
  barnModelLength,
  barnModelShell,
  barnModelWidth,
  type BarnModelFill,
} from "@/lib/farm/barn-model-dim";

export type { BarnModelRoomPlan };
export { BARN_MODEL_DIM };

export type BarnModelPenSide = "left" | "right" | "mid";

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
  wallH: number;
  status: ControllerStatus;
  /** 유형 LIVE 중 대표(가장 나쁜 상태). 방 단위 매핑 없음. */
  controllerKey: string | null;
  tempC: number | null;
  humidityPct: number | null;
  plan: BarnModelRoomPlan;
  fill: BarnModelFill;
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

/** 입구 거리에서 번호·채널이 읽히게. 1.15m는 자돈사 6.6m 왼쪽 벽 2열에 안 들어감. */
export const BARN_CTRL_W = 0.96;
export const BARN_CTRL_H = 0.74;
/** 상자 사이 빈 간격(m). 벽에 맞추며 이 값 아래로 줄이지 않는다. */
export const BARN_CTRL_GAP_X = 0.24;
export const BARN_CTRL_GAP_Y = 0.24;
export const BARN_CTRL_PAD = 0.12;
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
  dims: {
    width: number;
    length: number;
    aisleX: number;
    aisleW: number;
    wallH?: number;
  },
  side: "left" | "right",
  tileW: number,
  tileH: number,
): { position: [number, number, number]; rotY: number }[] {
  if (count <= 0) return [];
  const { width, length, aisleX, aisleW } = dims;
  const wallH = dims.wallH ?? BARN_MODEL_DIM.wallH;
  const aisleLeft = aisleX - aisleW / 2;
  const aisleRight = aisleX + aisleW / 2;
  const face = 0.07;
  const pad = BARN_CTRL_PAD;
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
  const yTop = wallH - pad - tileH / 2;
  const yBot = 0.36 + tileH / 2;
  const pitchY = tileH + BARN_CTRL_GAP_Y;
  const packH = (rows - 1) * pitchY;
  const yFirst =
    rows <= 1 ? Math.min(yTop, (yTop + yBot) / 2) : Math.min(yTop, yBot + packH);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      position: [xs[col] ?? xs[0]!, yFirst - row * pitchY, length / 2 + face],
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
  dims: {
    width: number;
    length: number;
    aisleX: number;
    aisleW: number;
    wallH?: number;
  },
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

export function ghostBuildingFromPlan(
  plan: BarnModelRoomPlan,
  label: string,
  origin: [number, number, number],
  rotDeg = 0,
  stallTyCode = "",
): BarnModelBuilding {
  const fill = barnModelFill({ stallTyCode, plan });
  const { length, width, wallH } = barnModelShell({ stallTyCode, plan });
  return {
    id: "__ghost__",
    label,
    stallTyCode,
    stallNo: "",
    origin,
    rotDeg,
    width,
    length,
    wallH,
    status: "normal",
    tempC: null,
    humidityPct: null,
    controllerKey: null,
    plan,
    fill,
    pens: assignPensFromReadings(
      [],
      plan,
      undefined,
      length,
      false,
      stallTyCode,
      width,
      wallH,
      fill,
    ),
  };
}

function penSideLabel(side: BarnModelPenSide): string {
  if (side === "mid") return "중";
  return side === "left" ? "좌" : "우";
}

function penLocalPos(
  side: BarnModelPenSide,
  index: number,
  length: number,
  width: number,
  wallH: number,
  fill: BarnModelFill,
): {
  localPos: [number, number, number];
  gatePos: [number, number, number];
  size: [number, number];
} {
  const banks = fill.banks;
  const bankIndex =
    side === "left" ? 0 : side === "right" ? banks - 1 : Math.min(1, banks - 1);
  const xs = barnModelBankCenters(width, banks, fill.penDepth, fill.aisleW);
  const x = xs[bankIndex] ?? 0;
  const rows = fill.roomCount;
  const penLen = (length - fill.endPad * 0.24) / rows;
  const z = length / 2 - penLen * (index + 0.5);
  const aisleXs = barnModelAisleCenters(width, banks, fill.penDepth, fill.aisleW);
  const gateX = aisleXs.reduce(
    (best, ax) => (Math.abs(ax - x) < Math.abs(best - x) ? ax : best),
    aisleXs[0] ?? x,
  );
  return {
    localPos: [x, 0.05, z],
    gatePos: [gateX, wallH * 0.38, z],
    size: [fill.penDepth - 0.12, Math.max(penLen - 0.08, 0.2)],
  };
}

export function listPlanSlots(
  plan: BarnModelRoomPlan,
): { side: BarnModelPenSide; index: number; id: string }[] {
  const slots: { side: BarnModelPenSide; index: number; id: string }[] = [];
  const rows = Math.max(plan.left, plan.right, plan.mid ?? 0);
  for (let i = 0; i < rows; i += 1) {
    if (i < plan.left) {
      slots.push({ side: "left", index: i, id: slotKey("left", i) });
    }
    if ((plan.mid ?? 0) > i) {
      slots.push({ side: "mid", index: i, id: slotKey("mid", i) });
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
  width = barnModelWidth(stallTyCode, plan),
  wallH: number = BARN_MODEL_DIM.wallH,
  fill = barnModelFill({ stallTyCode, plan }),
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
    const pos = penLocalPos(slot.side, slot.index, length, width, wallH, fill);
    return {
      id: slot.id,
      side: slot.side,
      index: slot.index,
      status: reading?.status ?? "empty",
      controllerKey: reading?.controllerKey ?? null,
      label:
        reading?.label ?? `${penSideLabel(slot.side)} ${slot.index + 1}`,
      ...pos,
    };
  });
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
    const { length, width, wallH } = barnModelShell(placed);
    const fill = barnModelFill(placed);
    const statuses = matched.map((r) => r.status);
    const status = worstControllerStatus(statuses);
    const primary = primaryReadingForType(matched);
    const penStatus: ControllerStatus | "empty" =
      matched.length > 0 ? status : "empty";
    const pens: BarnModelPen[] = assignPensFromReadings(
      matched,
      plan,
      undefined,
      length,
      false,
      ty,
      width,
      wallH,
      fill,
    ).map((pen) => ({
      ...pen,
      status: penStatus,
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
      wallH,
      status,
      controllerKey: primary?.controllerKey ?? null,
      tempC: primary?.tempC ?? null,
      humidityPct: primary?.humidityPct ?? null,
      plan,
      fill,
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

/** 전체 필드(작업 격자) 한 변. 편집 카메라는 동 묶음이 아니라 이 범위를 본다. */
export const BARN_MODEL_FIELD_M = 100;

export function barnModelFieldView(yard: Pick<BarnModelYard, "barns">): {
  centerX: number;
  centerZ: number;
  span: number;
} {
  const bounds = barnModelYardBounds(yard);
  const half = BARN_MODEL_FIELD_M / 2;
  const minX = Math.min(bounds.minX, -half);
  const maxX = Math.max(bounds.maxX, half);
  const minZ = Math.min(bounds.minZ, -half);
  const maxZ = Math.max(bounds.maxZ, half);
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX, maxZ - minZ, BARN_MODEL_FIELD_M),
  };
}

/** 놓은 동 묶음이 화면에 차도록. */
export function barnModelRoofHeight(span: number): number {
  const s = Number.isFinite(span) ? span : 32;
  return Math.round(Math.min(160, Math.max(14, s / 0.78 + 4)) * 10) / 10;
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

function barnModelRoofLookAt(
  centerX: number,
  centerZ: number,
  span: number,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  const h = barnModelRoofHeight(span);
  const zOff = h * (ROOF_POLAR_RUN / ROOF_POLAR_RISE);
  return {
    position: [centerX, h, centerZ + zOff],
    lookAt: [centerX, 0, centerZ],
  };
}

/** 편집 카메라 — 전체 필드. 동 묶음에 붙지 않음. */
export function barnModelFieldCameraPose(
  yard: Pick<BarnModelYard, "barns">,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  const { centerX, centerZ, span } = barnModelFieldView(yard);
  return barnModelRoofLookAt(centerX, centerZ, span);
}

/** 한 동만 화면 가운데(레거시). */
export function barnModelEditCameraPose(barn: {
  origin: [number, number, number];
  width: number;
  length: number;
}): { position: [number, number, number]; lookAt: [number, number, number] } {
  const [cx, , cz] = barn.origin;
  return barnModelRoofLookAt(cx, cz, Math.max(barn.width, barn.length, 8) + 10);
}

/** 방 편집 — 동·아래 카드가 들어가게. 필드보다 가깝고 레거시 한 동 줌보다 여유. */
export function barnModelFillEditCameraPose(barn: {
  origin: [number, number, number];
  width: number;
  length: number;
}): { position: [number, number, number]; lookAt: [number, number, number] } {
  const [cx, , cz] = barn.origin;
  return barnModelRoofLookAt(cx, cz, Math.max(barn.width, barn.length, 12) + 24);
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
  return barnModelRoofLookAt(cx, cz, barnModelYardBounds(yard).span);
}

