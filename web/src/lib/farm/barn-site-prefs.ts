/**
 * 모델 탭 배치 — 로컬만 (DB 없음). 옛 3D v2 키와 분리.
 */
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  barnSiteCoverKey,
  barnSiteRoomKey,
  barnSiteZoneKey,
  defaultBarnSiteRoomPlan,
  emptyBarnSitePrefs,
  BARN_SITE_PREFS_VERSION,
  type BarnSiteBuilding,
  type BarnSiteControllerCover,
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

function uniqueBanks(
  banks: readonly number[],
  fill: Pick<BarnSiteFill, "banks"> | undefined,
): number[] {
  const max = fill?.banks ?? BARN_MODEL_BANKS_MAX;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of banks) {
    const bank = Math.round(Number(raw));
    if (!Number.isFinite(bank) || bank < 0 || bank >= max) continue;
    if (seen.has(bank)) continue;
    seen.add(bank);
    out.push(bank);
  }
  out.sort((a, b) => a - b);
  return out;
}

function zoneKeyOnRoom(
  building: Pick<BarnSiteBuilding, "zones" | "fill">,
  room: BarnSiteRoomRef,
): string | null {
  for (const zone of building.zones) {
    const key = barnSiteZoneKey(zone.stallTyCode, zone.stallNo);
    if (!key) continue;
    const hit = zoneRoomsForFill(zone, building.fill).some(
      (row) => row.bank === room.bank && row.index === room.index,
    );
    if (hit) return key;
  }
  return null;
}

/** 고른 방이 같은 축사에 붙어 있으면 그 축사. */
export function zoneOnRooms(
  building: Pick<BarnSiteBuilding, "zones" | "fill">,
  rooms: readonly BarnSiteRoomRef[],
): Pick<BarnSiteZone, "stallTyCode" | "stallNo"> | null {
  const picked = uniqueFitRooms(rooms, building.fill);
  if (picked.length === 0) return null;
  let key: string | null = null;
  for (const room of picked) {
    const next = zoneKeyOnRoom(building, room);
    if (!next) return null;
    if (key == null) key = next;
    else if (key !== next) return null;
  }
  if (!key) return null;
  const split = key.indexOf("#");
  return {
    stallTyCode: key.slice(0, split),
    stallNo: key.slice(split + 1),
  };
}

export function roomsFromCover(
  cover: Pick<BarnSiteControllerCover, "rooms" | "banks">,
  fill: BarnSiteFill | undefined,
): BarnSiteRoomRef[] {
  if (cover.rooms && cover.rooms.length > 0) {
    return uniqueFitRooms(cover.rooms, fill);
  }
  if (!fill) return [];
  const out: BarnSiteRoomRef[] = [];
  for (const bank of uniqueBanks(cover.banks ?? [], fill)) {
    for (let index = 0; index < fill.roomCount; index++) {
      out.push({ bank, index });
    }
  }
  return uniqueFitRooms(out, fill);
}

function coverFirstRoom(
  rooms: readonly BarnSiteRoomRef[],
): BarnSiteRoomRef | null {
  let best: BarnSiteRoomRef | null = null;
  for (const room of rooms) {
    if (
      !best ||
      room.bank < best.bank ||
      (room.bank === best.bank && room.index < best.index)
    ) {
      best = room;
    }
  }
  return best;
}

/** 컨트롤러 구간. slot은 맞닿은 구간과 다른 색 번호(0–5). */
export type BarnPlanCoverMark = {
  slot: number;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  rooms: BarnSiteRoomRef[];
};

/** 평면 구간 식별색 개수. 채널·알람·브랜드와 겹치지 않는다. */
export const PLAN_COVER_COLOR_COUNT = 6;

function coverRoomKeys(rooms: readonly BarnSiteRoomRef[]): Set<string> {
  return new Set(rooms.map((room) => barnSiteRoomKey(room.bank, room.index)));
}

function coversTouch(
  aKeys: ReadonlySet<string>,
  bRooms: readonly BarnSiteRoomRef[],
): boolean {
  for (const room of bRooms) {
    if (
      aKeys.has(barnSiteRoomKey(room.bank, room.index - 1)) ||
      aKeys.has(barnSiteRoomKey(room.bank, room.index + 1)) ||
      aKeys.has(barnSiteRoomKey(room.bank - 1, room.index)) ||
      aKeys.has(barnSiteRoomKey(room.bank + 1, room.index))
    ) {
      return true;
    }
  }
  return false;
}

function colorCoverMarks(
  rows: Omit<BarnPlanCoverMark, "slot">[],
): BarnPlanCoverMark[] {
  const keys = rows.map((row) => coverRoomKeys(row.rooms));
  const usedByIndex: number[][] = rows.map(() => []);
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (
        coversTouch(keys[i]!, rows[j]!.rooms) ||
        coversTouch(keys[j]!, rows[i]!.rooms)
      ) {
        usedByIndex[i]!.push(j);
        usedByIndex[j]!.push(i);
      }
    }
  }
  const colors: number[] = rows.map(() => -1);
  for (let i = 0; i < rows.length; i++) {
    const taken = new Set<number>();
    for (const j of usedByIndex[i]!) {
      if (colors[j]! >= 0) taken.add(colors[j]!);
    }
    let color = 0;
    while (taken.has(color)) color += 1;
    colors[i] = color % PLAN_COVER_COLOR_COUNT;
  }
  return rows.map((row, i) => ({ ...row, slot: colors[i]! }));
}

export function barnPlanCoverMarks(
  covers: readonly BarnSiteControllerCover[],
  fill: BarnSiteFill | undefined,
): BarnPlanCoverMark[] {
  const rows = covers
    .map((cover) => ({
      stallTyCode: cover.stallTyCode,
      stallNo: cover.stallNo,
      eqpmnNo: cover.eqpmnNo,
      rooms: roomsFromCover(cover, fill),
    }))
    .filter((row) => row.rooms.length > 0);
  rows.sort((a, b) => {
    const fa = coverFirstRoom(a.rooms);
    const fb = coverFirstRoom(b.rooms);
    if (!fa || !fb) return 0;
    return fa.bank - fb.bank || fa.index - fb.index;
  });
  return colorCoverMarks(rows);
}

export function barnPlanCoverSlots(
  marks: readonly BarnPlanCoverMark[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mark of marks) {
    for (const room of mark.rooms) {
      out[barnSiteRoomKey(room.bank, room.index)] = mark.slot;
    }
  }
  return out;
}

function parseCover(raw: unknown): BarnSiteControllerCover | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stallTyCode = normalizeStallTyCode(
    typeof o.stallTyCode === "string" ? o.stallTyCode : "",
  );
  const stallNo =
    typeof o.stallNo === "string" ? o.stallNo.trim() : String(o.stallNo ?? "").trim();
  const zoneKey = barnSiteZoneKey(stallTyCode, stallNo);
  if (!zoneKey) return null;
  const eqpmnNo = normalizeEqpmnNo(o.eqpmnNo);
  const rooms = parseRooms(o.rooms) ?? [];
  const banksRaw = Array.isArray(o.banks) ? o.banks.map((n) => Number(n)) : [];
  const banks = uniqueBanks(banksRaw, undefined);
  if (rooms.length === 0 && banks.length === 0) return null;
  return {
    stallTyCode: zoneKey.slice(0, zoneKey.indexOf("#")),
    stallNo: zoneKey.slice(zoneKey.indexOf("#") + 1),
    eqpmnNo,
    rooms,
    ...(rooms.length === 0 && banks.length > 0 ? { banks } : {}),
  };
}

function pruneCovers(
  building: BarnSiteBuilding,
): BarnSiteControllerCover[] | undefined {
  const raw = building.controllerCovers ?? [];
  if (raw.length === 0) return undefined;
  const seen = new Map<string, BarnSiteControllerCover>();
  const out: BarnSiteControllerCover[] = [];
  for (const cover of raw) {
    const key = barnSiteCoverKey(cover.stallTyCode, cover.stallNo, cover.eqpmnNo);
    if (!key) continue;
    const zoneKey = barnSiteZoneKey(cover.stallTyCode, cover.stallNo);
    const rooms = roomsFromCover(cover, building.fill).filter(
      (room) => zoneKeyOnRoom(building, room) === zoneKey,
    );
    if (rooms.length === 0) continue;
    const prev = seen.get(key);
    if (prev) {
      prev.rooms = uniqueFitRooms([...prev.rooms, ...rooms], building.fill);
      continue;
    }
    const next = {
      stallTyCode: cover.stallTyCode,
      stallNo: cover.stallNo,
      eqpmnNo: cover.eqpmnNo,
      rooms,
    };
    seen.set(key, next);
    out.push(next);
  }
  return out.length > 0 ? out : undefined;
}

function pruneBuilding(building: BarnSiteBuilding): BarnSiteBuilding {
  const zones = building.zones
    .map((zone) => pruneZone(zone, building.fill))
    .filter((zone): zone is BarnSiteZone => Boolean(zone));
  const next = { ...building, zones };
  const controllerCovers = pruneCovers(next);
  if (controllerCovers) return { ...next, controllerCovers };
  const rest = { ...next };
  delete rest.controllerCovers;
  return rest;
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
  const coversRaw = Array.isArray(o.controllerCovers) ? o.controllerCovers : [];
  const controllerCovers: BarnSiteControllerCover[] = [];
  const seenCover = new Set<string>();
  for (const row of coversRaw) {
    const cover = parseCover(row);
    if (!cover) continue;
    const key = barnSiteCoverKey(cover.stallTyCode, cover.stallNo, cover.eqpmnNo);
    if (!key || seenCover.has(key)) continue;
    seenCover.add(key);
    controllerCovers.push(cover);
  }
  return {
    id,
    ...(name ? { name } : {}),
    x: Number.isFinite(Number(o.x)) ? Number(o.x) : 0,
    z: Number.isFinite(Number(o.z)) ? Number(o.z) : 0,
    rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
    zones,
    ...(fill ? { fill } : {}),
    ...(controllerCovers.length > 0 ? { controllerCovers } : {}),
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
          return pruneBuilding({ ...b, zones });
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
      return pruneBuilding({ ...b, zones });
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
    return pruneBuilding({ ...b, zones: [...rest, nextZone] });
  });
  return { ok: true, site: { ...site, buildings } };
}

export type AssignCtrlError =
  | "missing-building"
  | "out-of-fill"
  | "no-zone"
  | "not-in-live";

/** 고른 방에 컨트롤러를 붙이거나 뗀다. 그 방에 축사가 있어야 한다. */
export function paintControllerRoomsOnBuilding(
  site: BarnSitePrefs,
  buildingId: string,
  rooms: readonly BarnSiteRoomRef[],
  paint: { eqpmnNo: string } | null,
  liveCoverKeys?: ReadonlySet<string> | null,
): { ok: true; site: BarnSitePrefs } | { ok: false; error: AssignCtrlError } {
  const target = site.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, error: "missing-building" };
  const picked = uniqueFitRooms(rooms, target.fill);
  if (picked.length === 0) return { ok: false, error: "out-of-fill" };
  const drop = new Set(picked.map((room) => barnSiteRoomKey(room.bank, room.index)));

  if (!paint) {
    return {
      ok: true,
      site: {
        ...site,
        buildings: site.buildings.map((b) => {
          if (b.id !== buildingId) return b;
          const controllerCovers = (b.controllerCovers ?? [])
            .map((cover) => ({
              ...cover,
              rooms: roomsFromCover(cover, b.fill).filter(
                (room) => !drop.has(barnSiteRoomKey(room.bank, room.index)),
              ),
            }))
            .filter((cover) => cover.rooms.length > 0);
          return pruneBuilding({
            ...b,
            ...(controllerCovers.length > 0
              ? { controllerCovers }
              : { controllerCovers: undefined }),
          });
        }),
      },
    };
  }

  const zone = zoneOnRooms(target, picked);
  if (!zone) return { ok: false, error: "no-zone" };
  const eqpmnNo = normalizeEqpmnNo(paint.eqpmnNo);
  const coverKey = barnSiteCoverKey(zone.stallTyCode, zone.stallNo, eqpmnNo);
  if (!coverKey) return { ok: false, error: "no-zone" };
  if (liveCoverKeys && !liveCoverKeys.has(coverKey)) {
    return { ok: false, error: "not-in-live" };
  }

  const buildings = site.buildings.map((b) => {
    if (b.id !== buildingId) return b;
    const rest = (b.controllerCovers ?? [])
      .filter(
        (cover) =>
          barnSiteCoverKey(cover.stallTyCode, cover.stallNo, cover.eqpmnNo) !==
          coverKey,
      )
      .map((cover) => ({
        ...cover,
        rooms: roomsFromCover(cover, b.fill).filter(
          (room) => !drop.has(barnSiteRoomKey(room.bank, room.index)),
        ),
      }))
      .filter((cover) => cover.rooms.length > 0);
    const current = (b.controllerCovers ?? []).find(
      (cover) =>
        barnSiteCoverKey(cover.stallTyCode, cover.stallNo, cover.eqpmnNo) ===
        coverKey,
    );
    const merged = uniqueFitRooms(
      [...(current ? roomsFromCover(current, b.fill) : []), ...picked],
      b.fill,
    );
    const nextCover: BarnSiteControllerCover = {
      stallTyCode: zone.stallTyCode,
      stallNo: zone.stallNo,
      eqpmnNo,
      rooms: merged,
    };
    return pruneBuilding({
      ...b,
      controllerCovers: [...rest, nextCover],
    });
  });
  return { ok: true, site: { ...site, buildings } };
}

/** 모든 동의 축사 연결을 뗀다. 그 방에 붙었던 컨트롤러도 같이 떨어진다. */
export function clearAllZonesOnSite(site: BarnSitePrefs): BarnSitePrefs {
  return {
    ...site,
    buildings: site.buildings.map((b) => pruneBuilding({ ...b, zones: [] })),
  };
}

/** 모든 동의 컨트롤러 연결만 뗀다. 축사는 남는다. */
export function clearAllControllerCoversOnSite(
  site: BarnSitePrefs,
): BarnSitePrefs {
  return {
    ...site,
    buildings: site.buildings.map((b) => {
      const rest = { ...b };
      delete rest.controllerCovers;
      return pruneBuilding(rest);
    }),
  };
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
