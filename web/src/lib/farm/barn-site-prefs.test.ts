/**
 * 실행: npx tsx src/lib/farm/barn-site-prefs.test.ts
 */
import assert from "node:assert/strict";
import {
  addEmptyBuilding,
  assignRoomToBuilding,
  assignZoneToBuilding,
  buildingIdForZone,
  moveBuilding,
  parseBarnSitePrefs,
  paintControllerRoomsOnBuilding,
  paintRoomsOnBuilding,
  clearAllControllerCoversOnSite,
  clearAllZonesOnSite,
  removeBuilding,
  removeZoneFromBuilding,
  rotateBuilding,
  updateZonePlan,
  upsertLiveBuilding,
  upsertShellBuilding,
  zoneOnRooms,
  zonesForBuilding,
  barnPlanCoverMarks,
  barnPlanCoverSlots,
  barnPlanRoomTones,
} from "./barn-site-prefs";
import { emptyBarnSitePrefs, defaultBarnSiteRoomPlanForType } from "./barn-site-types";

{
  const empty = parseBarnSitePrefs(null);
  assert.equal(empty.buildings.length, 0);
  assert.equal(empty.v, 1);
}

{
  let site = emptyBarnSitePrefs();
  const a = addEmptyBuilding(site);
  site = a.site;
  const b = addEmptyBuilding(site);
  site = b.site;

  const live = new Set(["SP02#1", "SP05#2"]);
  const first = assignZoneToBuilding(
    site,
    a.buildingId,
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("first");
  site = first.site;

  const second = assignZoneToBuilding(
    site,
    a.buildingId,
    { stallTyCode: "SP05", stallNo: "2" },
    live,
  );
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error("second");
  site = second.site;

  assert.equal(zonesForBuilding(site, a.buildingId).length, 2);
  assert.equal(buildingIdForZone(site, "SP02", "1"), a.buildingId);
  assert.equal(buildingIdForZone(site, "SP05", "2"), a.buildingId);
  assert.equal(zonesForBuilding(site, b.buildingId).length, 0);

  const moved = assignZoneToBuilding(
    site,
    b.buildingId,
    { stallTyCode: "SP05", stallNo: "2" },
    live,
  );
  assert.equal(moved.ok, true);
  if (!moved.ok) throw new Error("moved");
  site = moved.site;
  assert.equal(buildingIdForZone(site, "SP05", "2"), b.buildingId);
  assert.equal(zonesForBuilding(site, a.buildingId).length, 1);

  const ghost = assignZoneToBuilding(
    site,
    a.buildingId,
    { stallTyCode: "SP03", stallNo: "9" },
    live,
  );
  assert.equal(ghost.ok, false);
  if (ghost.ok) throw new Error("ghost");
  assert.equal(ghost.error, "not-in-live");

  const bad = assignZoneToBuilding(
    site,
    a.buildingId,
    { stallTyCode: "SP02", stallNo: "" },
    live,
  );
  assert.equal(bad.ok, false);

  const round = parseBarnSitePrefs(JSON.parse(JSON.stringify(site)) as unknown);
  assert.equal(round.buildings.length, 2);
  assert.equal(zonesForBuilding(round, a.buildingId).length, 1);
  assert.equal(zonesForBuilding(round, b.buildingId).length, 1);
}

{
  let site = emptyBarnSitePrefs();
  const added = addEmptyBuilding(site);
  site = added.site;
  const live = new Set(["SP02#1"]);
  const put = assignZoneToBuilding(
    site,
    added.buildingId,
    { stallTyCode: "SP02", stallNo: "1", plan: { left: 4, right: 4 } },
    live,
  );
  assert.equal(put.ok, true);
  if (!put.ok) throw new Error("put");
  site = updateZonePlan(put.site, added.buildingId, "SP02", "1", {
    left: 6,
    right: 6,
  });
  assert.deepEqual(zonesForBuilding(site, added.buildingId)[0]?.plan, {
    left: 6,
    right: 6,
  });
  site = removeZoneFromBuilding(site, added.buildingId, "SP02", "1");
  assert.equal(zonesForBuilding(site, added.buildingId).length, 0);
  site = removeBuilding(site, added.buildingId);
  assert.equal(site.buildings.length, 0);
}

{
  let site = emptyBarnSitePrefs();
  const added = addEmptyBuilding(site, { x: 12, z: 40 });
  site = added.site;
  assert.equal(site.buildings[0]?.x, 12);
  assert.equal(site.buildings[0]?.z, 40);
  site = moveBuilding(site, added.buildingId, 55, 18);
  assert.equal(site.buildings[0]?.x, 55);
  assert.equal(site.buildings[0]?.z, 18);
  site = rotateBuilding(site, added.buildingId, 44);
  assert.equal(site.buildings[0]?.rotDeg, 45);
  site = rotateBuilding(site, added.buildingId, 355);
  assert.equal(site.buildings[0]?.rotDeg, 355);
}

{
  assert.deepEqual(defaultBarnSiteRoomPlanForType("SP02"), {
    left: 8,
    right: 8,
  });
  assert.deepEqual(defaultBarnSiteRoomPlanForType("SP07"), {
    left: 4,
    right: 4,
  });
}

{
  const live = new Set(["SP02#1"]);
  const first = upsertLiveBuilding(
    emptyBarnSitePrefs(),
    {
      stallTyCode: "SP02",
      stallNo: "01",
      name: "임신사 01",
      fill: {
        banks: 2,
        roomCount: 8,
        penAlongM: 0.65,
        penDepthM: 2.2,
        aisleWM: 1.8,
      },
      x: 20,
      z: 12,
    },
    live,
  );
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("upsert");
  assert.equal(buildingIdForZone(first.site, "SP02", "1"), first.buildingId);
  const again = upsertLiveBuilding(
    first.site,
    {
      stallTyCode: "SP02",
      stallNo: "1",
      fill: {
        banks: 3,
        roomCount: 6,
        penAlongM: 0.7,
        penDepthM: 2.2,
        aisleWM: 1.8,
      },
      x: 21,
      z: 12,
    },
    live,
  );
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error("upsert-2");
  assert.equal(again.buildingId, first.buildingId);
  assert.equal(again.site.buildings.length, 1);
  assert.equal(again.site.buildings[0]?.fill?.banks, 3);
  const round = parseBarnSitePrefs(JSON.parse(JSON.stringify(again.site)));
  assert.equal(round.buildings[0]?.fill?.roomCount, 6);
}

{
  const fill = {
    banks: 2 as const,
    roomCount: 8,
    penAlongM: 0.65,
    penDepthM: 2.2,
    aisleWM: 1.8,
  };
  const first = upsertShellBuilding(emptyBarnSitePrefs(), {
    fill,
    x: 20,
    z: 12,
  });
  assert.equal(first.site.buildings.length, 1);
  assert.equal(first.site.buildings[0]?.zones.length, 0);
  assert.equal(first.site.buildings[0]?.fill?.roomCount, 8);

  const live = new Set(["SP02#1", "SP05#2"]);
  const painted = assignRoomToBuilding(
    first.site,
    first.buildingId,
    { bank: 0, index: 0 },
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(painted.ok, true);
  if (!painted.ok) throw new Error("paint");
  assert.equal(buildingIdForZone(painted.site, "SP02", "1"), first.buildingId);
  const rooms = painted.site.buildings[0]?.zones[0]?.rooms;
  assert.equal(rooms?.length, 1);
  assert.deepEqual(rooms?.[0], { bank: 0, index: 0 });

  const again = assignRoomToBuilding(
    painted.site,
    first.buildingId,
    { bank: 0, index: 0 },
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error("toggle");
  assert.equal(again.site.buildings[0]?.zones.length, 0);

  const other = addEmptyBuilding(painted.site, { fill, x: 40, z: 12 });
  const moved = assignRoomToBuilding(
    other.site,
    other.buildingId,
    { bank: 1, index: 2 },
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(moved.ok, true);
  if (!moved.ok) throw new Error("move-key");
  assert.equal(buildingIdForZone(moved.site, "SP02", "1"), other.buildingId);
  assert.equal(zonesForBuilding(moved.site, first.buildingId).length, 0);

  const mixed = assignRoomToBuilding(
    moved.site,
    other.buildingId,
    { bank: 0, index: 0 },
    { stallTyCode: "SP05", stallNo: "2" },
    live,
  );
  assert.equal(mixed.ok, true);
  if (!mixed.ok) throw new Error("mixed");
  assert.equal(zonesForBuilding(mixed.site, other.buildingId).length, 2);

  const shrunk = upsertShellBuilding(mixed.site, {
    id: other.buildingId,
    fill: { ...fill, roomCount: 1 },
    x: 40,
    z: 12,
  });
  const kept = zonesForBuilding(shrunk.site, other.buildingId);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.stallTyCode, "SP05");
  assert.deepEqual(kept[0]?.rooms, [{ bank: 0, index: 0 }]);

  const gone = removeBuilding(shrunk.site, other.buildingId);
  assert.equal(gone.buildings.length, 1);

  const paintedAgain = assignRoomToBuilding(
    first.site,
    first.buildingId,
    { bank: 0, index: 3 },
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(paintedAgain.ok, true);
  if (!paintedAgain.ok) throw new Error("round");
  const round = parseBarnSitePrefs(JSON.parse(JSON.stringify(paintedAgain.site)));
  assert.equal(round.buildings[0]?.zones[0]?.rooms?.[0]?.index, 3);
}

{
  const fill = {
    banks: 5 as const,
    roomCount: 8,
    penAlongM: 0.65,
    penDepthM: 2.2,
    aisleWM: 1.8,
  };
  const first = upsertShellBuilding(emptyBarnSitePrefs(), {
    fill,
    x: 20,
    z: 12,
  });
  const live = new Set(["SP02#1"]);
  const painted = assignRoomToBuilding(
    first.site,
    first.buildingId,
    { bank: 4, index: 1 },
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(painted.ok, true);
  if (!painted.ok) throw new Error("five-bank");
  assert.deepEqual(painted.site.buildings[0]?.zones[0]?.rooms?.[0], {
    bank: 4,
    index: 1,
  });
  const round = parseBarnSitePrefs(
    JSON.parse(JSON.stringify(painted.site)) as unknown,
  );
  assert.deepEqual(round.buildings[0]?.zones[0]?.rooms?.[0], {
    bank: 4,
    index: 1,
  });
  const tones = barnPlanRoomTones(
    round.buildings[0]!.zones,
    fill,
    "SP02#1",
  );
  assert.equal(tones["4:1"], "paint");
  assert.equal(tones["0:0"], "empty");
}

{
  const fill = {
    banks: 2 as const,
    roomCount: 4,
    penAlongM: 0.65,
    penDepthM: 2.2,
    aisleWM: 1.8,
  };
  const first = upsertShellBuilding(emptyBarnSitePrefs(), {
    fill,
    x: 20,
    z: 12,
  });
  const second = upsertShellBuilding(first.site, {
    fill,
    x: 40,
    z: 12,
  });
  const live = new Set(["SP02#1", "SP05#2"]);
  const painted = paintRoomsOnBuilding(
    second.site,
    first.buildingId,
    [
      { bank: 0, index: 0 },
      { bank: 0, index: 1 },
      { bank: 0, index: 1 },
    ],
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(painted.ok, true);
  if (!painted.ok) throw new Error("paint-batch");
  assert.deepEqual(
    painted.site.buildings[0]?.zones[0]?.rooms?.map((r) => r.index).sort(),
    [0, 1],
  );
  const moved = paintRoomsOnBuilding(
    painted.site,
    second.buildingId,
    [{ bank: 1, index: 0 }],
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(moved.ok, true);
  if (!moved.ok) throw new Error("paint-move");
  assert.equal(zonesForBuilding(moved.site, first.buildingId).length, 0);
  assert.equal(buildingIdForZone(moved.site, "SP02", "1"), second.buildingId);
  const cleared = paintRoomsOnBuilding(
    moved.site,
    second.buildingId,
    [{ bank: 1, index: 0 }],
    null,
    live,
  );
  assert.equal(cleared.ok, true);
  if (!cleared.ok) throw new Error("paint-clear");
  assert.equal(zonesForBuilding(cleared.site, second.buildingId).length, 0);
}

{
  const fill = {
    banks: 4 as const,
    roomCount: 12,
    penAlongM: 1,
    penDepthM: 2,
    aisleWM: 1.2,
  };
  const first = upsertShellBuilding(emptyBarnSitePrefs(), {
    fill,
    x: 20,
    z: 12,
  });
  const live = new Set(["SP02#1"]);
  const painted = paintRoomsOnBuilding(
    first.site,
    first.buildingId,
    Array.from({ length: 12 }, (_, index) => ({ bank: 0, index })),
    { stallTyCode: "SP02", stallNo: "1" },
    live,
  );
  assert.equal(painted.ok, true);
  if (!painted.ok) throw new Error("ctrl-zone");
  const building = painted.site.buildings[0]!;
  const ten = Array.from({ length: 10 }, (_, index) => ({ bank: 0, index }));
  const zone = zoneOnRooms(building, ten);
  assert.equal(zone?.stallTyCode, "SP02");
  assert.equal(zone?.stallNo, "1");
  assert.equal(zoneOnRooms(building, [{ bank: 2, index: 0 }]), null);
  const covers = new Set(["SP02#1:01", "SP02#1:02"]);
  const attached = paintControllerRoomsOnBuilding(
    painted.site,
    first.buildingId,
    ten,
    { eqpmnNo: "1" },
    covers,
  );
  assert.equal(attached.ok, true);
  if (!attached.ok) throw new Error("ctrl-paint");
  const cover = attached.site.buildings[0]?.controllerCovers?.[0];
  assert.equal(cover?.eqpmnNo, "01");
  assert.deepEqual(
    cover?.rooms,
    ten,
  );
  assert.equal(
    cover?.rooms.some((room) => room.bank === 0 && room.index >= 10),
    false,
  );
  const round = parseBarnSitePrefs(JSON.parse(JSON.stringify(attached.site)));
  assert.deepEqual(round.buildings[0]?.controllerCovers?.[0]?.rooms, ten);
  assert.equal(round.buildings[0]?.controllerCovers?.[0]?.banks, undefined);
  const missingRoom = paintControllerRoomsOnBuilding(
    attached.site,
    first.buildingId,
    [{ bank: 2, index: 0 }],
    { eqpmnNo: "1" },
    covers,
  );
  assert.equal(missingRoom.ok, false);
  if (missingRoom.ok) throw new Error("ctrl-empty-bank");
  assert.equal(missingRoom.error, "no-zone");
  const clearedCtrl = paintControllerRoomsOnBuilding(
    attached.site,
    first.buildingId,
    [{ bank: 0, index: 0 }],
    null,
    covers,
  );
  assert.equal(clearedCtrl.ok, true);
  if (!clearedCtrl.ok) throw new Error("ctrl-clear");
  assert.deepEqual(
    clearedCtrl.site.buildings[0]?.controllerCovers?.[0]?.rooms,
    ten.slice(1),
  );
  const stripped = paintRoomsOnBuilding(
    clearedCtrl.site,
    first.buildingId,
    ten.slice(1),
    null,
    live,
  );
  assert.equal(stripped.ok, true);
  if (!stripped.ok) throw new Error("ctrl-prune");
  assert.equal(stripped.site.buildings[0]?.controllerCovers, undefined);

  const legacy = parseBarnSitePrefs({
    v: 1,
    buildings: [
      {
        id: first.buildingId,
        x: 20,
        z: 12,
        rotDeg: 0,
        fill,
        zones: [
          {
            stallTyCode: "SP02",
            stallNo: "1",
            rooms: ten,
            plan: { left: 1, right: 0 },
          },
        ],
        controllerCovers: [
          { stallTyCode: "SP02", stallNo: "1", eqpmnNo: "01", banks: [0] },
        ],
      },
    ],
  });
  const legacyCover = legacy.buildings[0]?.controllerCovers?.[0];
  assert.deepEqual(legacyCover?.rooms, ten);
  assert.equal(legacyCover?.banks, undefined);

  const ctrlOnly = clearAllControllerCoversOnSite(attached.site);
  assert.equal(ctrlOnly.buildings[0]?.controllerCovers, undefined);
  assert.equal(ctrlOnly.buildings[0]?.zones.length, 1);
  const barnGone = clearAllZonesOnSite(attached.site);
  assert.equal(barnGone.buildings[0]?.zones.length, 0);
  assert.equal(barnGone.buildings[0]?.controllerCovers, undefined);
}

{
  const fill = {
    banks: 4 as const,
    roomCount: 16,
    penAlongM: 1,
    penDepthM: 2,
    aisleWM: 1.2,
  };
  const ten = Array.from({ length: 10 }, (_, index) => ({ bank: 0, index }));
  const six = Array.from({ length: 6 }, (_, i) => ({ bank: 0, index: i + 10 }));
  const marks = barnPlanCoverMarks(
    [
      {
        stallTyCode: "SP03",
        stallNo: "1",
        eqpmnNo: "05",
        rooms: six,
      },
      {
        stallTyCode: "SP03",
        stallNo: "1",
        eqpmnNo: "01",
        rooms: ten,
      },
    ],
    fill,
  );
  assert.equal(marks.length, 2);
  assert.equal(marks[0]?.eqpmnNo, "01");
  assert.equal(marks[0]?.rooms.length, 10);
  assert.equal(marks[1]?.eqpmnNo, "05");
  assert.equal(marks[1]?.rooms.length, 6);
  const slots = barnPlanCoverSlots(marks);
  assert.equal(slots["0:0"], 0);
  assert.equal(slots["0:9"], 0);
  assert.notEqual(slots["0:10"], slots["0:0"]);
}

{
  const fill = {
    banks: 4 as const,
    roomCount: 4,
    penAlongM: 1,
    penDepthM: 2,
    aisleWM: 1.2,
  };
  const cell = (bank: number, index: number, no: string) => ({
    stallTyCode: "SP03",
    stallNo: "1",
    eqpmnNo: no,
    rooms: [{ bank, index }],
  });
  const grid = barnPlanCoverMarks(
    [
      cell(0, 0, "01"),
      cell(1, 0, "02"),
      cell(0, 1, "03"),
      cell(1, 1, "04"),
    ],
    fill,
  );
  const byNo = Object.fromEntries(grid.map((row) => [row.eqpmnNo, row.slot]));
  assert.notEqual(byNo["01"], byNo["02"]);
  assert.notEqual(byNo["01"], byNo["03"]);
  assert.notEqual(byNo["04"], byNo["02"]);
  assert.notEqual(byNo["04"], byNo["03"]);
  assert.equal(byNo["01"], byNo["04"]);
  assert.equal(byNo["02"], byNo["03"]);
  const far = barnPlanCoverMarks(
    [cell(0, 0, "01"), cell(2, 0, "03")],
    fill,
  );
  assert.equal(far[0]?.slot, far[1]?.slot);
}

console.log("barn-site-prefs.test.ts: ok");
