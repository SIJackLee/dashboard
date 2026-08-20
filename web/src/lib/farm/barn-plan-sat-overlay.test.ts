/**
 * 실행: npx tsx src/lib/farm/barn-plan-sat-overlay.test.ts
 */
import assert from "node:assert/strict";
import { buildBarnPlanField, metersPerDegree } from "./barn-plan-field";
import {
  BARN_PLAN_SAT_MAX_TILES,
  barnPlanSatEsriTileUrl,
  barnPlanSatOverlayTiles,
  barnPlanSatTileHref,
  barnPlanSatTileInRange,
  barnPlanSatVworldWmtsUrl,
  barnPlanSatZoomForField,
  latToTileY,
  lngToTileX,
  tileXToLng,
  tileYToLat,
} from "./barn-plan-sat-overlay";

{
  assert.equal(lngToTileX(0, 1), 1);
  assert.ok(tileXToLng(1, 1) >= 0);
  const y = latToTileY(38, 18);
  assert.ok(y > 0);
  assert.ok(tileYToLat(y, 18) >= 38);
  assert.ok(barnPlanSatTileInRange(18, 223000, 99000));
  assert.equal(barnPlanSatTileInRange(18, -1, 0), false);
}

{
  const esri = barnPlanSatEsriTileUrl(18, 10, 20);
  assert.ok(esri.includes("/tile/18/20/10"));
  const vworld = barnPlanSatVworldWmtsUrl(18, 10, 20, "k");
  assert.ok(vworld.includes("/Satellite/18/20/10.jpeg"));
  const href = barnPlanSatTileHref(18, 10, 20);
  assert.ok(href.startsWith("/api/farm-plan/sat-overlay?"));
  assert.ok(href.includes("z=18"));
  assert.ok(href.includes("x=10"));
  assert.ok(href.includes("y=20"));
}

{
  const z = barnPlanSatZoomForField(155, 89, 38);
  assert.ok(z >= 15 && z <= 19);
}

{
  const m = metersPerDegree(38);
  const origin = { lat: 38, lng: 127 };
  const east = { lat: 38, lng: 127 + 10 / m.lng };
  const north = { lat: 38 + 10 / m.lat, lng: 127 };
  const ne = { lat: 38 + 10 / m.lat, lng: 127 + 10 / m.lng };
  const square = [origin, east, ne, north];
  const field = buildBarnPlanField(
    [{ id: "a", label: "1답", ring: square }],
    square,
  );
  assert.ok(field);
  const tiles = barnPlanSatOverlayTiles(field);
  assert.ok(tiles.length >= 1);
  assert.ok(tiles.length <= BARN_PLAN_SAT_MAX_TILES);
  for (const tile of tiles) {
    assert.ok(tile.widthM > 0);
    assert.ok(tile.heightM > 0);
    assert.ok(barnPlanSatTileInRange(tile.z, tile.x, tile.y));
  }
  const zs = new Set(tiles.map((t) => t.z));
  assert.equal(zs.size, 1);
}

{
  const big = barnPlanSatOverlayTiles({
    originLat: 38,
    originLng: 127,
    widthM: 2000,
    heightM: 2000,
  });
  assert.ok(big.length <= BARN_PLAN_SAT_MAX_TILES);
}

console.log("barn-plan-sat-overlay.test.ts: ok");
