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
  barnSiteCoverKey,
  barnSiteZoneKey,
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
  buildings: readonly {
    id: string;
    fill?: BarnSiteFill;
    x?: number;
    footprint?: BarnPlanFootprint;
  }[],
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
    const fp =
      b.footprint ?? barnPlanFootprint("", barnPlanFillFromBuilding(b.fill));
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

/** 생성: 방 패킹 AABB + 위쪽 이름 태그 자리. 동 좌표는 이 크기로 먼저 잡는다. */
export function barnPlanModelPackedFootprint(
  fill: BarnModelFill,
  covers: readonly BarnPlanModelCoverIn[] = [],
  tagReserveM = barnPlanZoneTagReserveM(),
): BarnPlanFootprint {
  return modelPackedMeta(fill, covers, tagReserveM).fp;
}

function modelPackedMeta(
  fill: BarnModelFill,
  covers: readonly BarnPlanModelCoverIn[],
  tagReserveM = barnPlanZoneTagReserveM(),
): { fp: BarnPlanFootprint; shortM: number } {
  const packed = barnPlanModelLayout(fill, covers, tagReserveM);
  const bounds = barnPlanCellsBounds(packed.cells);
  if (!bounds) {
    const fp = barnPlanFootprint("", fill);
    return { fp, shortM: Math.min(fp.lengthM, fp.widthM) };
  }
  return {
    fp: {
      lengthM: bounds.w + tagReserveM,
      widthM: bounds.h,
    },
    shortM: Math.min(bounds.w, bounds.h),
  };
}

/** 생성: 패킹된 동 크기로 가로 일렬. 동 사이는 가장 작은 동 짧은 변 100%. */
export function barnPlanModelRowLayout(
  buildings: readonly {
    id: string;
    fill?: BarnSiteFill;
    x?: number;
    covers?: readonly BarnPlanModelCoverIn[];
  }[],
  padM = ASSIGN_PAD_M,
  tagReserveM = barnPlanZoneTagReserveM(),
): {
  widthM: number;
  heightM: number;
  items: Record<string, BarnPlanPlacePos & { rotDeg: number }>;
} {
  const pad = Math.max(1, snap1(padM));
  const items: Record<string, BarnPlanPlacePos & { rotDeg: number }> = {};
  if (buildings.length === 0) {
    return { widthM: pad * 2, heightM: pad * 2, items };
  }
  const ordered = [...buildings]
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    .map((b) => {
      const fill = barnPlanFillFromBuilding(b.fill);
      const meta = modelPackedMeta(fill, b.covers ?? [], tagReserveM);
      return {
        id: b.id,
        span: barnPlanAxisSpan(meta.fp, 90),
        shortM: meta.shortM,
      };
    });
  const maxH = Math.max(...ordered.map((r) => r.span.widthM), 1);
  const gapM =
    Math.min(...ordered.map((r) => r.shortM)) *
    BARN_PLAN_MODEL_BUILDING_GAP_RATIO;
  let cursor = pad;
  const z = snap1(pad + maxH / 2);
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!;
    const halfX = row.span.lengthM / 2;
    cursor += halfX;
    items[row.id] = { x: snap1(cursor), z, rotDeg: 90 };
    cursor += halfX;
    if (i < ordered.length - 1) cursor += gapM;
  }
  const widthM = snap1(cursor + pad);
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

/** 고른 방이 차지하는 로컬 사각형. */
export function barnPlanRoomBounds(
  fill: BarnModelFill,
  rooms: readonly { bank: number; index: number }[],
): { x: number; y: number; w: number; h: number } | null {
  const wanted = new Set(rooms.map((row) => `${row.bank}:${row.index}`));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of barnPlanFillCells(fill)) {
    if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
      continue;
    }
    if (!wanted.has(`${cell.bank}:${cell.index}`)) continue;
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + cell.w);
    maxY = Math.max(maxY, cell.y + cell.h);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
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

/** 생성: 동(그룹1) 사이 — 가장 작은 동 짧은 변의 비율. */
export const BARN_PLAN_MODEL_BUILDING_GAP_RATIO = 1;
/** 생성: 동 전체를 감싼 뒤 사방 여유. */
export const BARN_PLAN_MODEL_WELL_PAD_RATIO = 0.2;
/** 생성 줌. 1 = 배경 맞춤, 최대 = 기본의 3배. */
export const BARN_PLAN_MODEL_ZOOM_MIN = 1;
export const BARN_PLAN_MODEL_ZOOM_MAX = 3;
export const BARN_PLAN_ZONE_TAG_H_M = 3.2;
export const BARN_PLAN_ZONE_TAG_GAP_M = 0.5;
/** 태그 위·위 구획 사이. 테두리가 방에 걸치지 않게. */
export const BARN_PLAN_ZONE_TAG_CLEARANCE_M = 1;
/** 생성: 측정한 태그 높이로 간격을 늘릴 때 상한. */
export const BARN_PLAN_ZONE_TAG_RESERVE_MAX_M = 12;

/** 구획 위쪽에 이름 태그가 들어갈 간격. */
export function barnPlanZoneTagReserveM(
  tagHM = BARN_PLAN_ZONE_TAG_H_M,
): number {
  return tagHM + BARN_PLAN_ZONE_TAG_GAP_M + BARN_PLAN_ZONE_TAG_CLEARANCE_M;
}

export type BarnPlanCamera = {
  k: number;
  cx: number;
  cz: number;
};

export type BarnPlanViewBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 동 전체 사방 여유. pad만큼 좌표를 밀면 동이 가운데 남는다. */
export function barnPlanPadField(
  field: { widthM: number; heightM: number },
  ratio = BARN_PLAN_MODEL_WELL_PAD_RATIO,
): { widthM: number; heightM: number; padX: number; padZ: number } {
  const r = Math.max(0, ratio);
  const padX = field.widthM * r;
  const padZ = field.heightM * r;
  return {
    widthM: field.widthM + 2 * padX,
    heightM: field.heightM + 2 * padZ,
    padX,
    padZ,
  };
}

export function barnPlanCameraViewBox(
  field: { widthM: number; heightM: number },
  cam: BarnPlanCamera,
): BarnPlanViewBox {
  const k = Math.min(
    BARN_PLAN_MODEL_ZOOM_MAX,
    Math.max(BARN_PLAN_MODEL_ZOOM_MIN, cam.k),
  );
  const w = field.widthM / k;
  const h = field.heightM / k;
  const x = Math.min(Math.max(0, cam.cx - w / 2), Math.max(0, field.widthM - w));
  const svgCy = field.heightM - cam.cz;
  const y = Math.min(Math.max(0, svgCy - h / 2), Math.max(0, field.heightM - h));
  return { x, y, w, h };
}

export function barnPlanClampCamera(
  field: { widthM: number; heightM: number },
  cam: BarnPlanCamera,
): BarnPlanCamera {
  const k = Math.min(
    BARN_PLAN_MODEL_ZOOM_MAX,
    Math.max(BARN_PLAN_MODEL_ZOOM_MIN, cam.k),
  );
  const vb = barnPlanCameraViewBox(field, { ...cam, k });
  return {
    k,
    cx: vb.x + vb.w / 2,
    cz: field.heightM - (vb.y + vb.h / 2),
  };
}

export function barnPlanCameraFit(
  field: { widthM: number; heightM: number },
): BarnPlanCamera {
  return barnPlanClampCamera(field, {
    k: BARN_PLAN_MODEL_ZOOM_MIN,
    cx: field.widthM / 2,
    cz: field.heightM / 2,
  });
}

/** 생성 태그 실측·추정 너비가 구획 화면폭을 넘지 않는 최소 k. */
export function barnPlanCameraTagFitK(
  field: { widthM: number },
  viewWpx: number,
  tags: readonly { widthM: number; needPx: number }[],
): number {
  if (!(viewWpx > 0) || !(field.widthM > 0)) return BARN_PLAN_MODEL_ZOOM_MIN;
  let k = BARN_PLAN_MODEL_ZOOM_MIN;
  for (const tag of tags) {
    if (!(tag.widthM > 0) || !(tag.needPx > 0)) continue;
    const atMin = (tag.widthM / field.widthM) * viewWpx;
    if (atMin < 1) continue;
    k = Math.max(k, tag.needPx / atMin);
  }
  return Math.min(BARN_PLAN_MODEL_ZOOM_MAX, k);
}

const TAG_FIT_FONT_PX = 13;
const TAG_FIT_PAD_PX = 12;
const TAG_FIT_MARK_PX = 22;

/** 축사유형·번호 태그 예상 너비(px). DOM 실측 전에 씀. */
export function barnPlanZoneTagNeedPx(tag: {
  label: string;
  stallNo?: string;
  eqpmnNo?: string;
  envCount?: number;
}): number {
  const line1 = tag.label.length * TAG_FIT_FONT_PX + TAG_FIT_PAD_PX;
  const marks =
    (tag.stallNo ? TAG_FIT_MARK_PX : 0) +
    (tag.eqpmnNo ? TAG_FIT_MARK_PX : 0) +
    (tag.stallNo && tag.eqpmnNo ? 4 : 0);
  const line2 = marks > 0 ? marks + TAG_FIT_PAD_PX : 0;
  const env = (tag.envCount ?? 0) * 18;
  return Math.ceil(Math.max(line1, line2, env + TAG_FIT_PAD_PX) * 1.08);
}

export function barnPlanCameraZoomAt(
  field: { widthM: number; heightM: number },
  cam: BarnPlanCamera,
  at: { x: number; z: number },
  nextK: number,
): BarnPlanCamera {
  const from = barnPlanClampCamera(field, cam);
  const k = Math.min(
    BARN_PLAN_MODEL_ZOOM_MAX,
    Math.max(BARN_PLAN_MODEL_ZOOM_MIN, nextK),
  );
  if (from.k === k) return from;
  const t = from.k / k;
  return barnPlanClampCamera(field, {
    k,
    cx: at.x + (from.cx - at.x) * t,
    cz: at.z + (from.cz - at.z) * t,
  });
}

export type BarnPlanModelCoverIn = {
  rooms: readonly { bank: number; index: number }[];
  stallTyCode?: string;
  stallNo?: string;
  eqpmnNo?: string;
};

function roomKey(bank: number, index: number): string {
  return `${bank}:${index}`;
}

function coverZoneKey(cover: BarnPlanModelCoverIn): string {
  return barnSiteZoneKey(cover.stallTyCode, cover.stallNo) ?? "";
}

function fitCoverRooms(
  fill: BarnModelFill,
  rooms: readonly { bank: number; index: number }[],
): { bank: number; index: number }[] {
  const seen = new Set<string>();
  const out: { bank: number; index: number }[] = [];
  for (const row of rooms) {
    if (
      row.bank < 0 ||
      row.bank >= fill.banks ||
      row.index < 0 ||
      row.index >= fill.roomCount
    ) {
      continue;
    }
    const key = roomKey(row.bank, row.index);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bank: row.bank, index: row.index });
  }
  return out;
}

function collapsedRoomCells(fill: BarnModelFill): BarnPlanFillCell[] {
  const length = fill.roomCount * fill.penAlong + fill.endPad;
  const width = fill.banks * fill.penDepth;
  const cells: BarnPlanFillCell[] = [];
  for (let b = 0; b < fill.banks; b++) {
    for (let i = 0; i < fill.roomCount; i++) {
      cells.push({
        kind: "room",
        bank: b,
        index: i,
        x: -length / 2 + i * fill.penAlong,
        y: -width / 2 + b * fill.penDepth,
        w: fill.penAlong,
        h: fill.penDepth,
      });
    }
  }
  return cells;
}

function roomCoverMap(
  fill: BarnModelFill,
  covers: readonly BarnPlanModelCoverIn[],
): Map<string, { zone: string; cover: string }> {
  const out = new Map<string, { zone: string; cover: string }>();
  covers.forEach((cover, i) => {
    const zone = coverZoneKey(cover);
    const coverId =
      barnSiteCoverKey(cover.stallTyCode, cover.stallNo, cover.eqpmnNo) ??
      `cover:${i}`;
    for (const row of fitCoverRooms(fill, cover.rooms)) {
      out.set(roomKey(row.bank, row.index), { zone, cover: coverId });
    }
  });
  return out;
}

/** 방 AABB의 짧은 변 (m). 여유율 간격의 기준. */
export function barnPlanRoomsShortSideM(
  fill: BarnModelFill,
  rooms: readonly { bank: number; index: number }[],
  cells?: BarnPlanFillCell[],
): number {
  const fitted = fitCoverRooms(fill, rooms);
  const bounds = barnPlanCellsBounds(
    cells ?? collapsedRoomCells(fill),
    fitted,
  );
  if (!bounds) return Math.min(fill.penAlong, fill.penDepth);
  return Math.min(bounds.w, bounds.h);
}

function neighborGapM(
  a: { cover: string } | undefined,
  b: { cover: string } | undefined,
  aisleW: number,
  alongRooms: boolean,
  tagReserveM: number,
): number {
  if (!a || !b) return 0;
  if (a.cover === b.cover) return 0;
  if (alongRooms) return Math.max(aisleW, tagReserveM);
  return aisleW;
}

/** 방 번호마다 폭이 다르면 동 안 가로 중앙에 맞춘다. 90° 후 화면 좌우. */
function centerPackedStripsAlongY(cells: BarnPlanFillCell[]): void {
  const byIndex = new Map<number, BarnPlanFillCell[]>();
  for (const cell of cells) {
    if (cell.kind !== "room" || cell.index == null) continue;
    const list = byIndex.get(cell.index);
    if (list) list.push(cell);
    else byIndex.set(cell.index, [cell]);
  }
  if (byIndex.size === 0) return;
  const bounds = barnPlanCellsBounds(cells);
  if (!bounds) return;
  const mid = bounds.y + bounds.h / 2;
  for (const list of byIndex.values()) {
    let min = Infinity;
    let max = -Infinity;
    for (const cell of list) {
      min = Math.min(min, cell.y);
      max = Math.max(max, cell.y + cell.h);
    }
    const shift = mid - (min + max) / 2;
    if (Math.abs(shift) < 1e-9) continue;
    for (const cell of list) cell.y += shift;
  }
}

/**
 * 생성용 칸. 복도만 걷고 방 격자는 유지한다.
 * 같은 컨트롤러(그룹2)는 붙인다. 옆으로 다른 컨트롤러는 복도 너비,
 * 위아래로 다른 컨트롤러는 태그 높이만큼 띄워 구획 위에 태그가 앉게 한다.
 * 한 열의 그룹2가 더 좁으면 동 안 가로 중앙에 둔다.
 */
export function barnPlanModelLayout(
  fill: BarnModelFill,
  covers: readonly BarnPlanModelCoverIn[],
  tagReserveM = barnPlanZoneTagReserveM(),
): { cells: BarnPlanFillCell[]; extraLengthM: number; extraWidthM: number } {
  const wanted = new Set<string>();
  for (const cover of covers) {
    for (const row of fitCoverRooms(fill, cover.rooms)) {
      wanted.add(roomKey(row.bank, row.index));
    }
  }
  const byRoom = roomCoverMap(fill, covers);
  const aisleW = fill.aisleW;
  const xAt: number[][] = [];
  const yAt: number[][] = [];
  for (let b = 0; b < fill.banks; b++) {
    xAt[b] = [];
    yAt[b] = [];
    for (let i = 0; i < fill.roomCount; i++) {
      const left =
        i === 0
          ? 0
          : (xAt[b]![i - 1] ?? 0) +
            neighborGapM(
              byRoom.get(roomKey(b, i - 1)),
              byRoom.get(roomKey(b, i)),
              aisleW,
              true,
              tagReserveM,
            );
      const above =
        b === 0
          ? 0
          : (yAt[b - 1]![i] ?? 0) +
            neighborGapM(
              byRoom.get(roomKey(b - 1, i)),
              byRoom.get(roomKey(b, i)),
              aisleW,
              false,
              tagReserveM,
            );
      xAt[b]![i] = left;
      yAt[b]![i] = above;
    }
  }
  let extraLengthM = 0;
  let extraWidthM = 0;
  for (let b = 0; b < fill.banks; b++) {
    extraLengthM = Math.max(
      extraLengthM,
      xAt[b]![fill.roomCount - 1] ?? 0,
    );
  }
  for (let i = 0; i < fill.roomCount; i++) {
    extraWidthM = Math.max(extraWidthM, yAt[fill.banks - 1]![i] ?? 0);
  }
  const cells: BarnPlanFillCell[] = [];
  for (const cell of collapsedRoomCells(fill)) {
    if (cell.bank == null || cell.index == null) continue;
    if (wanted.size > 0 && !wanted.has(roomKey(cell.bank, cell.index))) {
      continue;
    }
    cells.push({
      ...cell,
      x: cell.x + (xAt[cell.bank]![cell.index] ?? 0),
      y: cell.y + (yAt[cell.bank]![cell.index] ?? 0),
    });
  }
  centerPackedStripsAlongY(cells);
  const bounds = barnPlanCellsBounds(cells);
  if (bounds) {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    for (const cell of cells) {
      cell.x -= cx;
      cell.y -= cy;
    }
  }
  return { cells, extraLengthM, extraWidthM };
}

export function barnPlanLerpModelCells(
  fill: BarnModelFill,
  covers: readonly BarnPlanModelCoverIn[],
  t: number,
  tagReserveM = barnPlanZoneTagReserveM(),
): BarnPlanFillCell[] {
  const u0 = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const from = barnPlanFillCells(fill);
  if (u0 <= 0) return from;
  const to = barnPlanModelLayout(fill, covers, tagReserveM).cells;
  if (u0 >= 1) return to;
  const dest = new Map<string, BarnPlanFillCell>();
  for (const cell of to) {
    if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
      continue;
    }
    dest.set(roomKey(cell.bank, cell.index), cell);
  }
  const coverAt = new Map<string, number>();
  covers.forEach((cover, i) => {
    for (const row of cover.rooms) {
      const key = roomKey(row.bank, row.index);
      if (!coverAt.has(key)) coverAt.set(key, i);
    }
  });
  const n = Math.max(covers.length, 1);
  const fade = barnPlanEmphasisT(u0);
  const cells: BarnPlanFillCell[] = [];
  for (const cell of from) {
    if (cell.kind === "aisle") {
      const s = 1 - fade;
      if (s <= 0.001) continue;
      cells.push({
        ...cell,
        y: cell.y + (cell.h * (1 - s)) / 2,
        h: cell.h * s,
      });
      continue;
    }
    if (cell.bank == null || cell.index == null) continue;
    const next = dest.get(roomKey(cell.bank, cell.index));
    if (!next) {
      if (u0 < 1) cells.push(cell);
      continue;
    }
    const slot = coverAt.get(roomKey(cell.bank, cell.index)) ?? n - 1;
    const u = barnPlanEmphasisT(barnPlanAssignStaggerT(u0, slot, n));
    cells.push({
      ...cell,
      x: barnPlanLerp(cell.x, next.x, u),
      y: barnPlanLerp(cell.y, next.y, u),
      w: barnPlanLerp(cell.w, next.w, u),
      h: barnPlanLerp(cell.h, next.h, u),
    });
  }
  return cells;
}

export type BarnPlanFieldBox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function barnPlanLocalRectToFieldBox(
  origin: BarnPlanPlacePos,
  rotDeg: number,
  rect: { x: number; y: number; w: number; h: number },
): BarnPlanFieldBox {
  const pts = [
    barnPlanLocalToField(origin, rotDeg, rect.x, rect.y),
    barnPlanLocalToField(origin, rotDeg, rect.x + rect.w, rect.y),
    barnPlanLocalToField(origin, rotDeg, rect.x + rect.w, rect.y + rect.h),
    barnPlanLocalToField(origin, rotDeg, rect.x, rect.y + rect.h),
  ];
  return {
    minX: Math.min(pts[0]!.x, pts[1]!.x, pts[2]!.x, pts[3]!.x),
    maxX: Math.max(pts[0]!.x, pts[1]!.x, pts[2]!.x, pts[3]!.x),
    minZ: Math.min(pts[0]!.z, pts[1]!.z, pts[2]!.z, pts[3]!.z),
    maxZ: Math.max(pts[0]!.z, pts[1]!.z, pts[2]!.z, pts[3]!.z),
  };
}

const TAG_W_MIN_M = 7;

export function barnPlanSpreadZoneLabels(
  seeds: readonly {
    id: string;
    label: string;
    detail?: string;
    box: BarnPlanFieldBox;
    /** 생성: 구획 위 바깥. 배치·연결: 구획 안쪽 중앙. */
    outside: boolean;
    /** 있으면 동 위 한 줄(방법 B). 생성 화면은 쓰지 않음. */
    group?: string;
    order?: string;
  }[],
  field: { widthM: number; heightM: number },
): { id: string; label: string; detail?: string; x: number; z: number }[] {
  const result: {
    id: string;
    label: string;
    detail?: string;
    x: number;
    z: number;
    group?: string;
  }[] = new Array(seeds.length);
  const grouped = new Map<string, number[]>();
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    if (!seed.outside) {
      const cx = (seed.box.minX + seed.box.maxX) / 2;
      const cz = (seed.box.minZ + seed.box.maxZ) / 2;
      result[i] = {
        id: seed.id,
        label: seed.label,
        detail: seed.detail,
        x: cx,
        z: cz,
      };
      continue;
    }
    const key = seed.group?.trim() || `__${i}`;
    const list = grouped.get(key) ?? [];
    list.push(i);
    grouped.set(key, list);
  }
  const th = BARN_PLAN_ZONE_TAG_H_M;
  const gap = BARN_PLAN_ZONE_TAG_GAP_M;
  for (const [key, idxs] of grouped) {
    const named = !key.startsWith("__");
    if (named && idxs.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxZ = -Infinity;
      for (const i of idxs) {
        const box = seeds[i]!.box;
        minX = Math.min(minX, box.minX);
        maxX = Math.max(maxX, box.maxX);
        maxZ = Math.max(maxZ, box.maxZ);
      }
      const span = Math.max(maxX - minX, TAG_W_MIN_M);
      const z = Math.min(
        field.heightM - th / 2,
        Math.max(th / 2, maxZ + gap + th / 2),
      );
      const ordered = [...idxs].sort((a, b) => {
        const oa = seeds[a]!.order ?? "";
        const ob = seeds[b]!.order ?? "";
        const byOrder = oa.localeCompare(ob, undefined, { numeric: true });
        if (byOrder !== 0) return byOrder;
        return seeds[a]!.box.minX - seeds[b]!.box.minX;
      });
      const n = ordered.length;
      for (let k = 0; k < n; k++) {
        const i = ordered[k]!;
        const seed = seeds[i]!;
        result[i] = {
          id: seed.id,
          label: seed.label,
          detail: seed.detail,
          x: minX + ((k + 0.5) / n) * span,
          z,
          group: key,
        };
      }
      continue;
    }
    for (const i of idxs) {
      const seed = seeds[i]!;
      const box = seed.box;
      const cx = (box.minX + box.maxX) / 2;
      const z = box.maxZ + gap;
      result[i] = {
        id: seed.id,
        label: seed.label,
        detail: seed.detail,
        x: cx,
        z,
      };
    }
  }
  spreadOutsideLabels(result, TAG_W_MIN_M, BARN_PLAN_ZONE_TAG_H_M, field);
  return result.map(({ id, label, detail, x, z }) => ({
    id,
    label,
    detail,
    x,
    z,
  }));
}

function spreadOutsideLabels(
  pts: { x: number; z: number; group?: string }[],
  minW: number,
  minH: number,
  field: { widthM: number; heightM: number },
): void {
  const used = new Set<number>();
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i) || pts[i] == null) continue;
    const row = [i];
    used.add(i);
    for (let j = i + 1; j < pts.length; j++) {
      if (used.has(j) || pts[j] == null) continue;
      const gi = pts[i]!.group;
      const gj = pts[j]!.group;
      if (!gi || gi !== gj) continue;
      if (Math.abs(pts[j]!.z - pts[i]!.z) > minH * 0.8) continue;
      row.push(j);
      used.add(j);
    }
    if (row.length < 2) continue;
    row.sort((a, b) => pts[a]!.x - pts[b]!.x);
    for (let k = 1; k < row.length; k++) {
      const prev = pts[row[k - 1]!]!;
      const cur = pts[row[k]!]!;
      const need = prev.x + minW;
      if (cur.x < need) cur.x = need;
    }
    const last = pts[row[row.length - 1]!]!;
    const overflow = last.x - (field.widthM - minW / 2);
    if (overflow > 0) {
      for (const idx of row) pts[idx]!.x -= overflow;
    }
    const first = pts[row[0]!]!;
    if (first.x < minW / 2) {
      const shift = minW / 2 - first.x;
      for (const idx of row) pts[idx]!.x += shift;
    }
  }
}

export function barnPlanCellsBounds(
  cells: readonly BarnPlanFillCell[],
  rooms?: readonly { bank: number; index: number }[],
): { x: number; y: number; w: number; h: number } | null {
  const wanted =
    rooms == null
      ? null
      : new Set(rooms.map((row) => `${row.bank}:${row.index}`));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    if (wanted) {
      if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
        continue;
      }
      if (!wanted.has(`${cell.bank}:${cell.index}`)) continue;
    }
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + cell.w);
    maxY = Math.max(maxY, cell.y + cell.h);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function barnPlanCellsCentroid(
  cells: readonly BarnPlanFillCell[],
  rooms: readonly { bank: number; index: number }[],
): { x: number; y: number } | null {
  const wanted = new Set(rooms.map((row) => `${row.bank}:${row.index}`));
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const cell of cells) {
    if (cell.kind !== "room" || cell.bank == null || cell.index == null) {
      continue;
    }
    if (!wanted.has(`${cell.bank}:${cell.index}`)) continue;
    sx += cell.x + cell.w / 2;
    sy += cell.y + cell.h / 2;
    n += 1;
  }
  if (n === 0) return null;
  return { x: sx / n, y: sy / n };
}

/** 컨트롤러 구간(+남은 방)을 서로 떨어진 사각형으로 나눈다. */
export function barnPlanModelSections(
  fill: BarnModelFill,
  covers: readonly { rooms: readonly { bank: number; index: number }[] }[],
  leftover: readonly { bank: number; index: number }[],
): { x: number; y: number; w: number; h: number }[] {
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const cover of covers) {
    const bounds = barnPlanRoomBounds(fill, cover.rooms);
    if (bounds) boxes.push(bounds);
  }
  for (const cluster of barnPlanRoomClusters(fill, leftover)) {
    const bounds = barnPlanRoomBounds(fill, cluster.rooms);
    if (bounds) boxes.push(bounds);
  }
  return boxes;
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

/** 모바일 각도 핸들 — 탭 미세 움직임은 회전으로 치지 않음. */
export const BARN_PLAN_ROTATE_DEADZONE_PX = 8;
export const BARN_PLAN_ROTATE_DEADZONE_DEG = 2;

/** 필드 좌표에서 중심 → 점 각도(스냅 없음). 중심이면 null. */
export function barnPlanFieldAngleDeg(
  origin: BarnPlanPlacePos,
  at: BarnPlanPlacePos,
): number | null {
  const dx = at.x - origin.x;
  const dz = at.z - origin.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return null;
  return (Math.atan2(dz, dx) * 180) / Math.PI;
}

export function barnPlanAbsDegDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** pointerAngle − 현재 각도. 이후 move에서 이 차이를 유지. */
export function barnPlanRotateGrabOffsetDeg(
  pointerAngleDeg: number,
  currentRotDeg: number,
): number {
  return pointerAngleDeg - currentRotDeg;
}

export function barnPlanRotateWithGrab(
  pointerAngleDeg: number,
  grabOffsetDeg: number,
): number {
  return barnPlanSnapRotDeg(pointerAngleDeg - grabOffsetDeg);
}

export function barnPlanRotateDragPastDeadzone(args: {
  startX: number;
  startY: number;
  x: number;
  y: number;
  startAngleDeg: number | null;
  angleDeg: number | null;
}): boolean {
  const px = Math.hypot(args.x - args.startX, args.y - args.startY);
  if (px >= BARN_PLAN_ROTATE_DEADZONE_PX) return true;
  if (args.startAngleDeg == null || args.angleDeg == null) return false;
  return (
    barnPlanAbsDegDelta(args.angleDeg, args.startAngleDeg) >=
    BARN_PLAN_ROTATE_DEADZONE_DEG
  );
}

/** 필드 좌표에서 중심 → 점 각도(5° 스냅). */
export function barnPlanRotateDeg(
  origin: BarnPlanPlacePos,
  at: BarnPlanPlacePos,
): number {
  const ang = barnPlanFieldAngleDeg(origin, at);
  if (ang == null) return 0;
  return barnPlanSnapRotDeg(ang);
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
