import {
  aisleCountForBanks,
  barnModelFill,
  barnModelShell,
  clampBarnAisleW,
  clampBarnBanks,
  clampBarnPenAlongM,
  clampBarnPenDepthM,
  maxRoomCount,
  planFromFill,
  BARN_MODEL_BANKS,
  type BarnModelBanks,
  type BarnModelFill,
} from "@/lib/farm/barn-model-dim";
import type { BarnPlanField, BarnPlanMetricPt } from "@/lib/farm/barn-plan-field";
import {
  defaultBarnSiteRoomPlanForType,
  type BarnSiteFill,
} from "@/lib/farm/barn-site-types";

export type BarnPlanFillPatch = {
  penAlong?: number;
  penDepth?: number;
  aisleW?: number;
  banks?: BarnModelBanks;
  roomCount?: number;
};

export type BarnPlanFootprint = {
  lengthM: number;
  widthM: number;
};

export type BarnPlanPlacePos = {
  x: number;
  z: number;
};

const SNAP_M = 1;
const SNAP_ROT_DEG = 5;

export function barnPlanFillEqual(
  a: BarnModelFill,
  b: BarnModelFill,
): boolean {
  return (
    a.banks === b.banks &&
    a.roomCount === b.roomCount &&
    Math.abs(a.penAlong - b.penAlong) < 1e-6 &&
    Math.abs(a.penDepth - b.penDepth) < 1e-6 &&
    Math.abs(a.aisleW - b.aisleW) < 1e-6
  );
}

export function defaultBarnPlanFill(stallTyCode: string): BarnModelFill {
  return barnModelFill({
    stallTyCode,
    plan: defaultBarnSiteRoomPlanForType(stallTyCode),
  });
}

/** LIVE 없이 올리는 동. 열 2, 칸 8. */
export function defaultBarnPlanShellFill(): BarnModelFill {
  return barnModelFill({
    stallTyCode: "",
    plan: { left: 8, right: 8 },
    banks: 2,
  });
}

export function barnPlanFillFromBuilding(
  fill: BarnSiteFill | undefined,
): BarnModelFill {
  if (!fill) return defaultBarnPlanShellFill();
  return barnPlanFillFromSite(
    "",
    fill,
    planFromFill(fill.banks, fill.roomCount),
  );
}

export function barnPlanFillFromSite(
  stallTyCode: string,
  fill: BarnSiteFill | undefined,
  plan = defaultBarnSiteRoomPlanForType(stallTyCode),
): BarnModelFill {
  if (!fill) {
    return barnModelFill({ stallTyCode, plan });
  }
  return barnModelFill({
    stallTyCode,
    plan: planFromFill(fill.banks, fill.roomCount),
    banks: fill.banks,
    penAlongM: fill.penAlongM,
    penDepthM: fill.penDepthM,
    aisleWM: fill.aisleWM,
  });
}

export function barnSiteFillFromModel(fill: BarnModelFill): BarnSiteFill {
  return {
    banks: fill.banks,
    roomCount: fill.roomCount,
    penAlongM: fill.penAlong,
    penDepthM: fill.penDepth,
    aisleWM: fill.aisleW,
  };
}

export function applyBarnPlanFillPatch(
  fill: BarnModelFill,
  stallTyCode: string,
  patch: BarnPlanFillPatch,
): BarnModelFill {
  const penAlong =
    patch.penAlong == null
      ? fill.penAlong
      : clampBarnPenAlongM(patch.penAlong);
  const penDepth =
    patch.penDepth == null
      ? fill.penDepth
      : clampBarnPenDepthM(patch.penDepth);
  const aisleW =
    patch.aisleW == null ? fill.aisleW : clampBarnAisleW(patch.aisleW);
  const banks =
    patch.banks == null ? fill.banks : clampBarnBanks(patch.banks);
  const raw =
    patch.roomCount == null ? fill.roomCount : patch.roomCount;
  const roomCount = Math.max(
    1,
    Math.min(maxRoomCount(stallTyCode, penAlong), Math.round(raw)),
  );
  return {
    ...fill,
    penAlong,
    penDepth,
    aisleW,
    banks,
    roomCount,
  };
}

export function barnPlanFootprint(
  stallTyCode: string,
  fill: BarnModelFill,
): BarnPlanFootprint {
  const shell = barnModelShell({
    stallTyCode,
    plan: planFromFill(fill.banks, fill.roomCount),
    banks: fill.banks,
    penAlongM: fill.penAlong,
    penDepthM: fill.penDepth,
    aisleWM: fill.aisleW,
  });
  return { lengthM: shell.length, widthM: shell.width };
}

export function barnPlanRingCentroidM(
  ring: BarnPlanMetricPt[],
): BarnPlanPlacePos | null {
  if (ring.length < 3) return null;
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p.x;
    z += p.y;
  }
  const n = ring.length;
  return { x: x / n, z: z / n };
}

function snap1(n: number): number {
  return Math.round(n / SNAP_M) * SNAP_M;
}

const ASSIGN_GAP_M = 4;
const ASSIGN_PAD_M = 6;
const EMPHASIS_BEZIER = [0.2, 0.8, 0.2, 1] as const;

function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function barnPlanLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0–360, 짧은 쪽으로. */
export function barnPlanLerpAngleDeg(a: number, b: number, t: number): number {
  const from = ((a % 360) + 360) % 360;
  const to = ((b % 360) + 360) % 360;
  let d = to - from;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (((from + d * t) % 360) + 360) % 360;
}

/** `--motion-ease-emphasis` cubic-bezier(0.2, 0.8, 0.2, 1) */
export function barnPlanEmphasisT(t: number): number {
  const x = clamp01(t);
  const [x1, y1, x2, y2] = EMPHASIS_BEZIER;
  let u = x;
  for (let i = 0; i < 6; i++) {
    const mu = 1 - u;
    const xEst = 3 * mu * mu * u * x1 + 3 * mu * u * u * x2 + u * u * u;
    const dx =
      3 * mu * mu * x1 + 6 * mu * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = clamp01(u - (xEst - x) / dx);
  }
  const mu = 1 - u;
  return 3 * mu * mu * u * y1 + 3 * mu * u * u * y2 + u * u * u;
}

/** 같은 emphasis 구간에서 왼쪽 동부터 일어선다. */
export function barnPlanAssignStaggerT(
  t: number,
  index: number,
  count: number,
): number {
  const n = Math.max(1, count);
  const lag = n <= 1 ? 0 : Math.min(0.32, 0.1 * (n - 1));
  const start = n <= 1 ? 0 : (index / (n - 1)) * lag;
  return clamp01((clamp01(t) - start) / (1 - lag));
}

/** 부여 단계용 — 동은 세로(긴 축), 동끼리는 가로 일렬. 배치 좌표는 건드리지 않는다. */
export function barnPlanAssignRowLayout(
  buildings: readonly { id: string; fill?: BarnSiteFill; x?: number }[],
  gapM = ASSIGN_GAP_M,
  padM = ASSIGN_PAD_M,
): {
  widthM: number;
  heightM: number;
  items: Record<string, BarnPlanPlacePos & { rotDeg: number }>;
} {
  const gap = Math.max(1, snap1(gapM));
  const pad = Math.max(1, snap1(padM));
  const items: Record<string, BarnPlanPlacePos & { rotDeg: number }> = {};
  if (buildings.length === 0) {
    return { widthM: pad * 2, heightM: pad * 2, items };
  }
  const ordered = [...buildings].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const rows = ordered.map((b) => {
    const fp = barnPlanFootprint("", barnPlanFillFromBuilding(b.fill));
    const span = barnPlanAxisSpan(fp, 90);
    return { id: b.id, span };
  });
  const maxH = Math.max(...rows.map((r) => r.span.widthM), 1);
  let cursor = pad;
  const z = snap1(pad + maxH / 2);
  for (const row of rows) {
    const halfX = row.span.lengthM / 2;
    cursor += halfX;
    items[row.id] = { x: snap1(cursor), z, rotDeg: 90 };
    cursor += halfX + gap;
  }
  const widthM = snap1(cursor - gap + pad);
  const heightM = snap1(pad * 2 + maxH);
  return { widthM: Math.max(widthM, 1), heightM: Math.max(heightM, 1), items };
}

function clampCenter(
  center: number,
  half: number,
  span: number,
): number {
  const lo = half;
  const hi = span - half;
  if (hi <= lo) return snap1(span / 2);
  return Math.min(hi, Math.max(lo, center));
}

function overlaps(
  a: BarnPlanPlacePos & BarnPlanFootprint,
  b: BarnPlanPlacePos & BarnPlanFootprint,
): boolean {
  const gap = 1;
  return (
    Math.abs(a.x - b.x) < (a.lengthM + b.lengthM) / 2 + gap &&
    Math.abs(a.z - b.z) < (a.widthM + b.widthM) / 2 + gap
  );
}

/** 필드 한가운데(1m 스냅). 이미 올린 동과 겹치면 옆으로 민다. */
export function barnPlanPlaceOrigin(
  field: Pick<BarnPlanField, "widthM" | "heightM" | "ring">,
  footprint: BarnPlanFootprint,
  occupied: (BarnPlanPlacePos & BarnPlanFootprint)[] = [],
): BarnPlanPlacePos {
  const seed = barnPlanRingCentroidM(field.ring) ?? {
    x: field.widthM / 2,
    z: field.heightM / 2,
  };
  const halfL = footprint.lengthM / 2;
  const halfW = footprint.widthM / 2;
  const start = {
    x: clampCenter(snap1(seed.x), halfL, field.widthM),
    z: clampCenter(snap1(seed.z), halfW, field.heightM),
  };
  const step = Math.max(2, snap1(footprint.lengthM + 2));
  for (let i = 0; i < 24; i++) {
    const x = clampCenter(start.x + i * step, halfL, field.widthM);
    const z = start.z;
    const next = { x, z, ...footprint };
    if (!occupied.some((row) => overlaps(next, row))) {
      return { x, z };
    }
  }
  return start;
}

export type BarnPlanFillCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "room" | "aisle";
  bank?: number;
  index?: number;
};

/** 동 로컬 좌표. 원점은 중심, x=길이, y=폭. */
export function barnPlanFillCells(fill: BarnModelFill): BarnPlanFillCell[] {
  const aisleN = aisleCountForBanks(fill.banks);
  const length = fill.roomCount * fill.penAlong + fill.endPad;
  const width = fill.banks * fill.penDepth + aisleN * fill.aisleW;
  const cells: BarnPlanFillCell[] = [];
  let y = -width / 2;
  for (let b = 0; b < fill.banks; b++) {
    for (let i = 0; i < fill.roomCount; i++) {
      cells.push({
        kind: "room",
        bank: b,
        index: i,
        x: -length / 2 + i * fill.penAlong,
        y,
        w: fill.penAlong,
        h: fill.penDepth,
      });
    }
    y += fill.penDepth;
    if (b < aisleN) {
      cells.push({
        kind: "aisle",
        x: -length / 2,
        y,
        w: length,
        h: fill.aisleW,
      });
      y += fill.aisleW;
    }
  }
  return cells;
}

export type BarnPlanWindow = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
};

function aabbOverlap(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

/** 윈도우와 겹치는 방. 동이 여럿이면 겹친 칸이 가장 많은 동만. */
export function barnPlanRoomsInWindow(
  buildings: readonly {
    id: string;
    x: number;
    z: number;
    rotDeg: number;
    fill?: BarnModelFill;
  }[],
  win: BarnPlanWindow,
): { id: string; bank: number; index: number }[] {
  const box = {
    minX: Math.min(win.x0, win.x1),
    maxX: Math.max(win.x0, win.x1),
    minZ: Math.min(win.z0, win.z1),
    maxZ: Math.max(win.z0, win.z1),
  };
  const hits: { id: string; bank: number; index: number }[] = [];
  for (const b of buildings) {
    if (!b.fill) continue;
    const origin = { x: b.x, z: b.z };
    for (const cell of barnPlanFillCells(b.fill)) {
      if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
        continue;
      }
      const corners = [
        barnPlanLocalToField(origin, b.rotDeg, cell.x, cell.y),
        barnPlanLocalToField(origin, b.rotDeg, cell.x + cell.w, cell.y),
        barnPlanLocalToField(origin, b.rotDeg, cell.x + cell.w, cell.y + cell.h),
        barnPlanLocalToField(origin, b.rotDeg, cell.x, cell.y + cell.h),
      ];
      const room = {
        minX: Math.min(...corners.map((c) => c.x)),
        maxX: Math.max(...corners.map((c) => c.x)),
        minZ: Math.min(...corners.map((c) => c.z)),
        maxZ: Math.max(...corners.map((c) => c.z)),
      };
      if (aabbOverlap(box, room)) {
        hits.push({ id: b.id, bank: cell.bank, index: cell.index });
      }
    }
  }
  if (hits.length <= 1) return hits;
  const counts = new Map<string, number>();
  for (const hit of hits) {
    counts.set(hit.id, (counts.get(hit.id) ?? 0) + 1);
  }
  let bestId = hits[0]!.id;
  let bestN = 0;
  for (const b of buildings) {
    const n = counts.get(b.id) ?? 0;
    if (n > bestN) {
      bestN = n;
      bestId = b.id;
    }
  }
  return hits.filter((hit) => hit.id === bestId);
}

function cellsTouch(
  a: BarnPlanFillCell,
  b: BarnPlanFillCell,
  gap = 0.05,
): boolean {
  return (
    a.x <= b.x + b.w + gap &&
    a.x + a.w + gap >= b.x &&
    a.y <= b.y + b.h + gap &&
    a.y + a.h + gap >= b.y
  );
}

/** 같은 축사로 붙은 칸 중, 맞닿은 덩어리. 중심은 동 로컬 좌표. */
export function barnPlanRoomClusters(
  fill: BarnModelFill,
  rooms: readonly { bank: number; index: number }[],
): { rooms: { bank: number; index: number }[]; x: number; y: number }[] {
  const cellByKey = new Map<string, BarnPlanFillCell>();
  for (const cell of barnPlanFillCells(fill)) {
    if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
      continue;
    }
    cellByKey.set(`${cell.bank}:${cell.index}`, cell);
  }
  const nodes = rooms.filter((row) =>
    cellByKey.has(`${row.bank}:${row.index}`),
  );
  const seen = new Set<string>();
  const clusters: {
    rooms: { bank: number; index: number }[];
    x: number;
    y: number;
  }[] = [];
  for (const start of nodes) {
    const startKey = `${start.bank}:${start.index}`;
    if (seen.has(startKey)) continue;
    const stack = [start];
    seen.add(startKey);
    const group: { bank: number; index: number }[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      group.push(cur);
      const a = cellByKey.get(`${cur.bank}:${cur.index}`);
      if (!a) continue;
      for (const next of nodes) {
        const nextKey = `${next.bank}:${next.index}`;
        if (seen.has(nextKey)) continue;
        const b = cellByKey.get(nextKey);
        if (!b || !cellsTouch(a, b)) continue;
        seen.add(nextKey);
        stack.push(next);
      }
    }
    let sx = 0;
    let sy = 0;
    for (const row of group) {
      const cell = cellByKey.get(`${row.bank}:${row.index}`);
      if (!cell) continue;
      sx += cell.x + cell.w / 2;
      sy += cell.y + cell.h / 2;
    }
    const n = Math.max(group.length, 1);
    clusters.push({ rooms: group, x: sx / n, y: sy / n });
  }
  return clusters;
}

export function pointInMetricRing(
  pt: BarnPlanMetricPt,
  ring: BarnPlanMetricPt[],
): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const hit =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

/** 5° 스냅. 0–355. */
export function barnPlanSnapRotDeg(deg: number): number {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  const snapped = Math.round(n / SNAP_ROT_DEG) * SNAP_ROT_DEG;
  const m = ((snapped % 360) + 360) % 360;
  return m === 360 ? 0 : m;
}

/** 필드 좌표에서 중심 → 점 각도. */
export function barnPlanRotateDeg(
  origin: BarnPlanPlacePos,
  at: BarnPlanPlacePos,
): number {
  const dx = at.x - origin.x;
  const dz = at.z - origin.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0;
  return barnPlanSnapRotDeg((Math.atan2(dz, dx) * 180) / Math.PI);
}

export function barnPlanLocalToField(
  origin: BarnPlanPlacePos,
  rotDeg: number,
  localX: number,
  localY: number,
): BarnPlanPlacePos {
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: origin.x + localX * c - localY * s,
    z: origin.z + localX * s + localY * c,
  };
}

export function barnPlanFieldToLocal(
  origin: BarnPlanPlacePos,
  rotDeg: number,
  at: BarnPlanPlacePos,
): { x: number; y: number } {
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = at.x - origin.x;
  const dz = at.z - origin.z;
  return {
    x: dx * c + dz * s,
    y: -dx * s + dz * c,
  };
}

export function barnPlanWidthForBanks(
  fill: Pick<BarnModelFill, "penDepth" | "aisleW">,
  banks: BarnModelBanks,
): number {
  return banks * fill.penDepth + aisleCountForBanks(banks) * fill.aisleW;
}

export function barnPlanBanksFromWidth(
  fill: Pick<BarnModelFill, "penDepth" | "aisleW">,
  widthM: number,
): BarnModelBanks {
  const w = Math.abs(widthM);
  let best: BarnModelBanks = 1;
  let bestD = Number.POSITIVE_INFINITY;
  for (const banks of BARN_MODEL_BANKS) {
    const d = Math.abs(barnPlanWidthForBanks(fill, banks) - w);
    if (d < bestD) {
      best = banks;
      bestD = d;
    }
  }
  return best;
}

export function barnPlanRoomCountFromLength(
  fill: Pick<BarnModelFill, "penAlong" | "endPad">,
  lengthM: number,
  stallTyCode = "",
): number {
  const raw = (Math.abs(lengthM) - fill.endPad) / fill.penAlong;
  return Math.max(
    1,
    Math.min(maxRoomCount(stallTyCode, fill.penAlong), Math.round(raw)),
  );
}

/** 회전한 동의 축 정렬 점유 폭. */
export function barnPlanAxisSpan(
  footprint: BarnPlanFootprint,
  rotDeg = 0,
): BarnPlanFootprint {
  const rad = (barnPlanSnapRotDeg(rotDeg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    lengthM: footprint.lengthM * c + footprint.widthM * s,
    widthM: footprint.lengthM * s + footprint.widthM * c,
  };
}

/** 1m 스냅 후 필드·구획 안으로. 구획 밖이면 null. */
export function barnPlanDragPos(
  field: Pick<BarnPlanField, "widthM" | "heightM" | "ring">,
  pos: BarnPlanPlacePos,
  footprint: BarnPlanFootprint,
  rotDeg = 0,
): BarnPlanPlacePos | null {
  const span = barnPlanAxisSpan(footprint, rotDeg);
  const x = clampCenter(snap1(pos.x), span.lengthM / 2, field.widthM);
  const z = clampCenter(snap1(pos.z), span.widthM / 2, field.heightM);
  if (!pointInMetricRing({ x, y: z }, field.ring)) return null;
  return { x, z };
}
