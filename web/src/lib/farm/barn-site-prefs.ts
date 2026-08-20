/**
 * 모델 탭 배치 — 로컬만 (DB 없음). 옛 3D v2 키와 분리.
 */
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  barnSiteRoomKey,
  barnSiteZoneKey,
  defaultBarnSiteRoomPlan,
  emptyBarnSitePrefs,
  BARN_SITE_PREFS_VERSION,
  type BarnSiteBuilding,
  type BarnSiteFill,
  type BarnSitePrefs,
  type BarnSiteRoomPlan,
  type BarnSiteRoomRef,
  type BarnSiteZone,
} from "@/lib/farm/barn-site-types";
import {
  BARN_MODEL_BANKS_MAX,
  clampBarnBanks,
  planFromFill,
} from "@/lib/farm/barn-model-dim";
import { barnPlanSnapRotDeg } from "@/lib/farm/barn-plan-place";

export function barnSitePrefsStorageKey(farmId: string): string {
  return `sungil.barn-plan.site.v1:${farmId}`;
}

function newBuildingId(): string {
  return `bd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampCount(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(200, Math.round(v));
}

function parsePlan(raw: unknown): BarnSiteRoomPlan {
  if (!raw || typeof raw !== "object") return defaultBarnSiteRoomPlan();
  const p = raw as { left?: unknown; right?: unknown; mid?: unknown };
  const mid = clampCount(p.mid);
  const left = clampCount(p.left);
  const right = clampCount(p.right);
  if (left + right + mid === 0) return defaultBarnSiteRoomPlan();
  return mid > 0 ? { left, right, mid } : { left, right };
}

function parseFill(raw: unknown): BarnSiteFill | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const banksN = Number(o.banks);
  const banks = clampBarnBanks(banksN);
  const roomCount = Math.max(1, clampCount(o.roomCount));
  const penAlongM = Number(o.penAlongM);
  const penDepthM = Number(o.penDepthM);
  const aisleWM = Number(o.aisleWM);
  if (
    !Number.isFinite(penAlongM) ||
    !Number.isFinite(penDepthM) ||
    !Number.isFinite(aisleWM)
  ) {
    return undefined;
  }
  return { banks, roomCount, penAlongM, penDepthM, aisleWM };
}

function parseRoom(raw: unknown): BarnSiteRoomRef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { bank?: unknown; index?: unknown };
  const bank = Math.round(Number(o.bank));
  const index = Math.round(Number(o.index));
  if (!Number.isFinite(bank) || !Number.isFinite(index)) return null;
  if (bank < 0 || index < 0 || bank >= BARN_MODEL_BANKS_MAX || index > 200) {
    return null;
  }
  return { bank, index };
}

function parseRooms(raw: unknown): BarnSiteRoomRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const rooms: BarnSiteRoomRef[] = [];
  for (const row of raw) {
    const room = parseRoom(row);
    if (!room) continue;
    const key = barnSiteRoomKey(room.bank, room.index);
    if (seen.has(key)) continue;
    seen.add(key);
    rooms.push(room);
  }
  return rooms;
}

function roomFitsFill(
  room: BarnSiteRoomRef,
  fill: Pick<BarnSiteFill, "banks" | "roomCount"> | undefined,
): boolean {
  if (!fill) return true;
  return room.bank < fill.banks && room.index < fill.roomCount;
}

function planFromRooms(rooms: BarnSiteRoomRef[]): BarnSiteRoomPlan {
  const left = rooms.filter((r) => r.bank === 0).length;
  const right = rooms.filter((r) => r.bank === 1).length;
  const mid = rooms.filter((r) => r.bank === 2).length;
  if (left + right + mid === 0) return defaultBarnSiteRoomPlan();
  return mid > 0 ? { left, right, mid } : { left, right };
}

export function expandPlanToRooms(
  plan: BarnSiteRoomPlan,
  fill: Pick<BarnSiteFill, "banks" | "roomCount"> | undefined,
): BarnSiteRoomRef[] {
  const banks = fill?.banks ?? 2;
  const roomCount = Math.max(1, fill?.roomCount ?? 8);
  const countAt = (bank: number): number => {
    if (bank === 0) return plan.left;
    if (bank === 1) return plan.right;
    return plan.mid ?? 0;
  };
  const rooms: BarnSiteRoomRef[] = [];
  for (let bank = 0; bank < banks; bank++) {
    const n = Math.min(roomCount, Math.max(0, countAt(bank)));
    for (let index = 0; index < n; index++) {
      rooms.push({ bank, index });
    }
  }
  return rooms;
}

export function zoneRoomsForFill(
  zone: BarnSiteZone,
  fill: Pick<BarnSiteFill, "banks" | "roomCount"> | undefined,
): BarnSiteRoomRef[] {
  if (zone.rooms) {
    return zone.rooms.filter((room) => roomFitsFill(room, fill));
  }
  return expandPlanToRooms(zone.plan, fill);
}

export type BarnPlanRoomTone = "paint" | "other" | "empty";

export function barnPlanRoomTone(
  zones: readonly BarnSiteZone[],
  fill: Pick<BarnSiteFill, "banks" | "roomCount"> | undefined,
  bank: number,
  index: number,
  paintKey: string | null,
): BarnPlanRoomTone {
  for (const zone of zones) {
    const hit = zoneRoomsForFill(zone, fill).some(
      (row) => row.bank === bank && row.index === index,
    );
    if (!hit) continue;
    const key = barnSiteZoneKey(zone.stallTyCode, zone.stallNo);
    if (paintKey && key === paintKey) return "paint";
    return "other";
  }
  return "empty";
}

export function barnPlanRoomTones(
  zones: readonly BarnSiteZone[],
  fill: Pick<BarnSiteFill, "banks" | "roomCount"> | undefined,
  paintKey: string | null,
): Record<string, BarnPlanRoomTone> {
  if (!fill) return {};
  const out: Record<string, BarnPlanRoomTone> = {};
  for (let bank = 0; bank < fill.banks; bank++) {
    for (let index = 0; index < fill.roomCount; index++) {
      out[barnSiteRoomKey(bank, index)] = barnPlanRoomTone(
        zones,
        fill,
        bank,
        index,
        paintKey,
      );
    }
  }
  return out;
}

function pruneZone(
  zone: BarnSiteZone,
  fill: BarnSiteFill | undefined,
): BarnSiteZone | null {
  const rooms = zoneRoomsForFill(zone, fill);
  if (rooms.length === 0) return null;
  return {
    ...zone,
    rooms,
    plan: planFromRooms(rooms),
  };
}

function pruneBuilding(building: BarnSiteBuilding): BarnSiteBuilding {
  const zones = building.zones
    .map((zone) => pruneZone(zone, building.fill))
    .filter((zone): zone is BarnSiteZone => Boolean(zone));
  return { ...building, zones };
}

function parseZone(raw: unknown): BarnSiteZone | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stallTyCode = normalizeStallTyCode(
    typeof o.stallTyCode === "string" ? o.stallTyCode : "",
  );
  const stallNo =
    typeof o.stallNo === "string" ? o.stallNo.trim() : String(o.stallNo ?? "").trim();
  const key = barnSiteZoneKey(stallTyCode, stallNo);
  if (!key) return null;
  const rooms = parseRooms(o.rooms);
  return {
    stallTyCode,
    stallNo: key.slice(key.indexOf("#") + 1),
    plan: parsePlan(o.plan),
    ...(rooms ? { rooms } : {}),
  };
}

function parseBuilding(raw: unknown): BarnSiteBuilding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const zonesRaw = Array.isArray(o.zones) ? o.zones : [];
  const seen = new Set<string>();
  const zones: BarnSiteZone[] = [];
  for (const row of zonesRaw) {
    const z = parseZone(row);
    if (!z) continue;
    const key = barnSiteZoneKey(z.stallTyCode, z.stallNo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    zones.push(z);
  }
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 24) : "";
  const fill = parseFill(o.fill);
  return {
    id,
    ...(name ? { name } : {}),
    x: Number.isFinite(Number(o.x)) ? Number(o.x) : 0,
    z: Number.isFinite(Number(o.z)) ? Number(o.z) : 0,
    rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
    zones,
    ...(fill ? { fill } : {}),
  };
}

export function parseBarnSitePrefs(raw: unknown): BarnSitePrefs {
  if (!raw || typeof raw !== "object") return emptyBarnSitePrefs();
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.buildings) ? o.buildings : [];
  const seenId = new Set<string>();
  const usedZone = new Set<string>();
  const buildings: BarnSiteBuilding[] = [];
  for (const row of list) {
    const b = parseBuilding(row);
    if (!b || seenId.has(b.id)) continue;
    const zones = b.zones.filter((z) => {
      const key = barnSiteZoneKey(z.stallTyCode, z.stallNo);
      if (!key || usedZone.has(key)) return false;
      usedZone.add(key);
      return true;
    });
    seenId.add(b.id);
    buildings.push(pruneBuilding({ ...b, zones }));
  }
  return { v: BARN_SITE_PREFS_VERSION, buildings };
}

export function buildingById(
  site: BarnSitePrefs,
  buildingId: string | null | undefined,
): BarnSiteBuilding | null {
  const id = (buildingId ?? "").trim();
  if (!id) return null;
  return site.buildings.find((b) => b.id === id) ?? null;
}

export function zonesForBuilding(
  site: BarnSitePrefs,
  buildingId: string | null | undefined,
): BarnSiteZone[] {
  return buildingById(site, buildingId)?.zones ?? [];
}

export function buildingIdForZone(
  site: BarnSitePrefs,
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): string | null {
  const key = barnSiteZoneKey(stallTyCode, stallNo);
  if (!key) return null;
  for (const b of site.buildings) {
    if (b.zones.some((z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) === key)) {
      return b.id;
    }
  }
  return null;
}

export type AssignZoneError =
  | "bad-zone"
  | "missing-building"
  | "not-in-live";

export function assignZoneToBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  zone: Pick<BarnSiteZone, "stallTyCode" | "stallNo"> &
    Partial<Pick<BarnSiteZone, "plan">>,
  liveZoneKeys?: ReadonlySet<string> | null,
): { ok: true; site: BarnSitePrefs } | { ok: false; error: AssignZoneError } {
  const key = barnSiteZoneKey(zone.stallTyCode, zone.stallNo);
  if (!key) return { ok: false, error: "bad-zone" };
  if (liveZoneKeys && !liveZoneKeys.has(key)) {
    return { ok: false, error: "not-in-live" };
  }
  const target = site.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, error: "missing-building" };

  const nextZone: BarnSiteZone = {
    stallTyCode: key.slice(0, key.indexOf("#")),
    stallNo: key.slice(key.indexOf("#") + 1),
    plan: zone.plan ?? defaultBarnSiteRoomPlan(),
  };

  const buildings = site.buildings.map((b) => {
    const without = b.zones.filter(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
    );
    if (b.id !== buildingId) return { ...b, zones: without };
    const rest = without.filter(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
    );
    return { ...b, zones: [...rest, nextZone] };
  });
  return { ok: true, site: { ...site, buildings } };
}

export function updateZonePlan(
  site: BarnSitePrefs,
  buildingId: string,
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
  plan: BarnSiteRoomPlan,
): BarnSitePrefs {
  const key = barnSiteZoneKey(stallTyCode, stallNo);
  if (!key) return site;
  const nextPlan = parsePlan(plan);
  return {
    ...site,
    buildings: site.buildings.map((b) => {
      if (b.id !== buildingId) return b;
      return {
        ...b,
        zones: b.zones.map((z) =>
          barnSiteZoneKey(z.stallTyCode, z.stallNo) === key
            ? { ...z, plan: nextPlan }
            : z,
        ),
      };
    }),
  };
}

export function removeZoneFromBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): BarnSitePrefs {
  const key = barnSiteZoneKey(stallTyCode, stallNo);
  if (!key) return site;
  return {
    ...site,
    buildings: site.buildings.map((b) => {
      if (b.id !== buildingId) return b;
      return {
        ...b,
        zones: b.zones.filter(
          (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
        ),
      };
    }),
  };
}

export function removeBuilding(
  site: BarnSitePrefs,
  buildingId: string,
): BarnSitePrefs {
  const id = buildingId.trim();
  if (!id) return site;
  return {
    ...site,
    buildings: site.buildings.filter((b) => b.id !== id),
  };
}

export function rotateBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  rotDeg: number,
): BarnSitePrefs {
  const id = buildingId.trim();
  if (!id) return site;
  const rot = barnPlanSnapRotDeg(rotDeg);
  return {
    ...site,
    buildings: site.buildings.map((b) =>
      b.id === id ? { ...b, rotDeg: rot } : b,
    ),
  };
}

export function moveBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  x: number,
  z: number,
): BarnSitePrefs {
  const id = buildingId.trim();
  if (!id) return site;
  const nx = Number.isFinite(x) ? x : 0;
  const nz = Number.isFinite(z) ? z : 0;
  return {
    ...site,
    buildings: site.buildings.map((b) =>
      b.id === id ? { ...b, x: nx, z: nz } : b,
    ),
  };
}

export function addEmptyBuilding(
  site: BarnSitePrefs,
  seed?: Partial<Pick<BarnSiteBuilding, "name" | "x" | "z" | "rotDeg" | "fill">>,
): { site: BarnSitePrefs; buildingId: string } {
  const id = newBuildingId();
  const building: BarnSiteBuilding = {
    id,
    x: seed?.x ?? 0,
    z: seed?.z ?? 0,
    rotDeg: seed?.rotDeg ?? 0,
    zones: [],
    ...(seed?.name?.trim() ? { name: seed.name.trim().slice(0, 24) } : {}),
    ...(seed?.fill ? { fill: seed.fill } : {}),
  };
  return {
    buildingId: id,
    site: { ...site, buildings: [...site.buildings, building] },
  };
}

export function upsertShellBuilding(
  site: BarnSitePrefs,
  input: {
    id?: string;
    name?: string;
    fill: BarnSiteFill;
    x: number;
    z: number;
    rotDeg?: number;
  },
): { site: BarnSitePrefs; buildingId: string } {
  const rotDeg = Number.isFinite(input.rotDeg) ? Number(input.rotDeg) : 0;
  const name = input.name?.trim().slice(0, 24) ?? "";
  const existing = input.id
    ? site.buildings.find((b) => b.id === input.id)
    : undefined;
  if (existing) {
    return {
      buildingId: existing.id,
      site: {
        ...site,
        buildings: site.buildings.map((b) =>
          b.id === existing.id
            ? pruneBuilding({
                ...b,
                x: input.x,
                z: input.z,
                rotDeg,
                fill: input.fill,
                ...(name ? { name } : {}),
              })
            : b,
        ),
      },
    };
  }
  return addEmptyBuilding(site, {
    name: name || undefined,
    fill: input.fill,
    x: input.x,
    z: input.z,
    rotDeg,
  });
}

function withoutRoom(
  zone: BarnSiteZone,
  room: BarnSiteRoomRef,
  fill: BarnSiteFill | undefined,
): BarnSiteZone | null {
  const rooms = zoneRoomsForFill(zone, fill).filter(
    (row) => !(row.bank === room.bank && row.index === room.index),
  );
  if (rooms.length === 0) return null;
  return { ...zone, rooms, plan: planFromRooms(rooms) };
}

function uniqueFitRooms(
  rooms: readonly BarnSiteRoomRef[],
  fill: BarnSiteFill | undefined,
): BarnSiteRoomRef[] {
  const seen = new Set<string>();
  const out: BarnSiteRoomRef[] = [];
  for (const room of rooms) {
    if (!roomFitsFill(room, fill)) continue;
    const k = barnSiteRoomKey(room.bank, room.index);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ bank: room.bank, index: room.index });
  }
  return out;
}

function withoutRooms(
  zone: BarnSiteZone,
  rooms: readonly BarnSiteRoomRef[],
  fill: BarnSiteFill | undefined,
): BarnSiteZone | null {
  let next: BarnSiteZone | null = zone;
  for (const room of rooms) {
    if (!next) return null;
    next = withoutRoom(next, room, fill);
  }
  return next;
}

export type AssignRoomError =
  | "bad-zone"
  | "missing-building"
  | "not-in-live"
  | "out-of-fill";

/** 고른 칸에 LIVE를 붙이거나(토글 없음) 떼기. 한 LIVE는 한 동만. */
export function paintRoomsOnBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  rooms: readonly BarnSiteRoomRef[],
  paint: Pick<BarnSiteZone, "stallTyCode" | "stallNo"> | null,
  liveZoneKeys?: ReadonlySet<string> | null,
): { ok: true; site: BarnSitePrefs } | { ok: false; error: AssignRoomError } {
  const target = site.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, error: "missing-building" };
  const picked = uniqueFitRooms(rooms, target.fill);
  if (picked.length === 0) return { ok: false, error: "out-of-fill" };

  if (!paint) {
    return {
      ok: true,
      site: {
        ...site,
        buildings: site.buildings.map((b) => {
          if (b.id !== buildingId) return b;
          const zones = b.zones
            .map((z) => withoutRooms(z, picked, b.fill))
            .filter((z): z is BarnSiteZone => Boolean(z));
          return { ...b, zones };
        }),
      },
    };
  }

  const key = barnSiteZoneKey(paint.stallTyCode, paint.stallNo);
  if (!key) return { ok: false, error: "bad-zone" };
  if (liveZoneKeys && !liveZoneKeys.has(key)) {
    return { ok: false, error: "not-in-live" };
  }
  const ty = key.slice(0, key.indexOf("#"));
  const no = key.slice(key.indexOf("#") + 1);

  const buildings = site.buildings.map((b) => {
    if (b.id !== buildingId) {
      const zones = b.zones.filter(
        (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
      );
      return { ...b, zones };
    }
    const stripped = b.zones
      .map((z) => withoutRooms(z, picked, b.fill))
      .filter((z): z is BarnSiteZone => Boolean(z));
    const rest = stripped.filter(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
    );
    const current = stripped.find(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) === key,
    );
    const merged = uniqueFitRooms(
      [...(current ? zoneRoomsForFill(current, b.fill) : []), ...picked],
      b.fill,
    );
    const nextZone: BarnSiteZone = {
      stallTyCode: ty,
      stallNo: no,
      rooms: merged,
      plan: planFromRooms(merged),
    };
    return { ...b, zones: [...rest, nextZone] };
  });
  return { ok: true, site: { ...site, buildings } };
}

/** 클릭한 방에 LIVE 축사를 붙이거나, 같은 칸을 다시 누르면 뗀다. 한 LIVE는 한 동만. */
export function assignRoomToBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  room: BarnSiteRoomRef,
  paint: Pick<BarnSiteZone, "stallTyCode" | "stallNo"> | null,
  liveZoneKeys?: ReadonlySet<string> | null,
): { ok: true; site: BarnSitePrefs } | { ok: false; error: AssignRoomError } {
  const target = site.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, error: "missing-building" };
  if (!roomFitsFill(room, target.fill)) {
    return { ok: false, error: "out-of-fill" };
  }

  if (!paint) {
    return {
      ok: true,
      site: {
        ...site,
        buildings: site.buildings.map((b) => {
          if (b.id !== buildingId) return b;
          const zones = b.zones
            .map((z) => withoutRoom(z, room, b.fill))
            .filter((z): z is BarnSiteZone => Boolean(z));
          return { ...b, zones };
        }),
      },
    };
  }

  const key = barnSiteZoneKey(paint.stallTyCode, paint.stallNo);
  if (!key) return { ok: false, error: "bad-zone" };
  if (liveZoneKeys && !liveZoneKeys.has(key)) {
    return { ok: false, error: "not-in-live" };
  }
  const ty = key.slice(0, key.indexOf("#"));
  const no = key.slice(key.indexOf("#") + 1);

  const alreadyHere = target.zones.some((z) => {
    if (barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key) return false;
    return zoneRoomsForFill(z, target.fill).some(
      (row) => row.bank === room.bank && row.index === room.index,
    );
  });
  if (alreadyHere) {
    return {
      ok: true,
      site: {
        ...site,
        buildings: site.buildings.map((b) => {
          if (b.id !== buildingId) return b;
          const zones = b.zones
            .map((z) => withoutRoom(z, room, b.fill))
            .filter((z): z is BarnSiteZone => Boolean(z));
          return { ...b, zones };
        }),
      },
    };
  }

  const buildings = site.buildings.map((b) => {
    const stripped = b.zones
      .map((z) => {
        const zoneKey = barnSiteZoneKey(z.stallTyCode, z.stallNo);
        if (zoneKey === key && b.id !== buildingId) return null;
        return withoutRoom(z, room, b.fill);
      })
      .filter((z): z is BarnSiteZone => Boolean(z));
    if (b.id !== buildingId) return { ...b, zones: stripped };

    const rest = stripped.filter(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
    );
    const current = stripped.find(
      (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) === key,
    );
    const rooms = [
      ...(current ? zoneRoomsForFill(current, b.fill) : []),
      room,
    ];
    const nextZone: BarnSiteZone = {
      stallTyCode: ty,
      stallNo: no,
      rooms,
      plan: planFromRooms(rooms),
    };
    return { ...b, zones: [...rest, nextZone] };
  });
  return { ok: true, site: { ...site, buildings } };
}

export function upsertLiveBuilding(
  site: BarnSitePrefs,
  input: {
    stallTyCode: string;
    stallNo: string;
    name?: string;
    fill: BarnSiteFill;
    x: number;
    z: number;
    rotDeg?: number;
  },
  liveZoneKeys?: ReadonlySet<string> | null,
): { ok: true; site: BarnSitePrefs; buildingId: string } | { ok: false; error: AssignZoneError } {
  const key = barnSiteZoneKey(input.stallTyCode, input.stallNo);
  if (!key) return { ok: false, error: "bad-zone" };
  if (liveZoneKeys && !liveZoneKeys.has(key)) {
    return { ok: false, error: "not-in-live" };
  }
  const ty = key.slice(0, key.indexOf("#"));
  const no = key.slice(key.indexOf("#") + 1);
  const zone: BarnSiteZone = {
    stallTyCode: ty,
    stallNo: no,
    plan: planFromFill(input.fill.banks, input.fill.roomCount),
  };
  const existingId = buildingIdForZone(site, ty, no);
  const rotDeg = Number.isFinite(input.rotDeg) ? Number(input.rotDeg) : 0;
  const name = input.name?.trim().slice(0, 24) ?? "";
  if (existingId) {
    return {
      ok: true,
      buildingId: existingId,
      site: {
        ...site,
        buildings: site.buildings.map((b) =>
          b.id === existingId
            ? {
                ...b,
                x: input.x,
                z: input.z,
                rotDeg,
                fill: input.fill,
                zones: [zone],
                ...(name ? { name } : {}),
              }
            : {
                ...b,
                zones: b.zones.filter(
                  (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) !== key,
                ),
              },
        ),
      },
    };
  }
  const id = newBuildingId();
  const building: BarnSiteBuilding = {
    id,
    x: input.x,
    z: input.z,
    rotDeg,
    fill: input.fill,
    zones: [zone],
    ...(name ? { name } : {}),
  };
  return {
    ok: true,
    buildingId: id,
    site: { ...site, buildings: [...site.buildings, building] },
  };
}

export function loadBarnSitePrefs(farmId: string): BarnSitePrefs {
  if (!farmId || typeof window === "undefined") return emptyBarnSitePrefs();
  try {
    const raw =
      window.localStorage.getItem(barnSitePrefsStorageKey(farmId)) ?? "";
    if (!raw) return emptyBarnSitePrefs();
    return parseBarnSitePrefs(JSON.parse(raw) as unknown);
  } catch {
    return emptyBarnSitePrefs();
  }
}

export function saveBarnSitePrefs(farmId: string, site: BarnSitePrefs): void {
  if (!farmId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      barnSitePrefsStorageKey(farmId),
      JSON.stringify(parseBarnSitePrefs(site)),
    );
  } catch {
    /* quota */
  }
}
