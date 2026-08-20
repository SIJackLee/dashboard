import {
  barnPlanFieldLatLngBox,
  metersPerDegree,
} from "@/lib/farm/barn-plan-field";

export const BARN_PLAN_SAT_MAX_TILES = 16;
export const BARN_PLAN_SAT_MIN_Z = 15;
export const BARN_PLAN_SAT_MAX_Z = 19;

export type BarnPlanSatTile = {
  z: number;
  x: number;
  y: number;
  svgX: number;
  svgY: number;
  widthM: number;
  heightM: number;
};

const EARTH_PX = 256;
const INITIAL_RES = 156543.03392804097;

export function lngToTileX(lng: number, z: number): number {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  return Math.min(n - 1, Math.max(0, x));
}

export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const clamped = Math.min(85.05112878, Math.max(-85.05112878, lat));
  const latRad = (clamped * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return Math.min(n - 1, Math.max(0, Math.floor(y)));
}

export function tileXToLng(x: number, z: number): number {
  const n = 2 ** z;
  return (x / n) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  const n = 2 ** z;
  const m = Math.PI * (1 - (2 * y) / n);
  return (Math.atan(Math.sinh(m)) * 180) / Math.PI;
}

export function barnPlanSatTileInRange(
  z: number,
  x: number,
  y: number,
): boolean {
  if (!Number.isInteger(z) || z < 0 || z > 22) return false;
  const n = 2 ** z;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < n && y < n;
}

export function barnPlanSatEsriTileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

export function barnPlanSatVworldWmtsUrl(
  z: number,
  x: number,
  y: number,
  key: string,
): string {
  return `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/${z}/${y}/${x}.jpeg`;
}

export function barnPlanSatTileHref(z: number, x: number, y: number): string {
  const q = new URLSearchParams({
    z: String(z),
    x: String(x),
    y: String(y),
  });
  return `/api/farm-plan/sat-overlay?${q.toString()}`;
}

function tileMeters(lat: number, z: number): number {
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return (EARTH_PX * INITIAL_RES * cos) / 2 ** z;
}

export function barnPlanSatZoomForField(
  widthM: number,
  heightM: number,
  lat: number,
): number {
  for (let z = BARN_PLAN_SAT_MAX_Z; z >= BARN_PLAN_SAT_MIN_Z; z--) {
    const tileM = tileMeters(lat, z);
    const nx = Math.ceil(Math.max(1, widthM) / tileM) + 1;
    const ny = Math.ceil(Math.max(1, heightM) / tileM) + 1;
    if (nx * ny <= BARN_PLAN_SAT_MAX_TILES) return z;
  }
  return BARN_PLAN_SAT_MIN_Z;
}

function tilesAtZoom(
  field: {
    originLat: number;
    originLng: number;
    widthM: number;
    heightM: number;
  },
  z: number,
): BarnPlanSatTile[] {
  const box = barnPlanFieldLatLngBox(field);
  const n = 2 ** z;
  let x0 = lngToTileX(box.minLng, z);
  let x1 = lngToTileX(box.maxLng, z);
  let y0 = latToTileY(box.maxLat, z);
  let y1 = latToTileY(box.minLat, z);
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  x0 = Math.max(0, x0);
  x1 = Math.min(n - 1, x1);
  y0 = Math.max(0, y0);
  y1 = Math.min(n - 1, y1);
  const m = metersPerDegree(field.originLat);
  const tiles: BarnPlanSatTile[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const west = tileXToLng(x, z);
      const east = tileXToLng(x + 1, z);
      const north = tileYToLat(y, z);
      const south = tileYToLat(y + 1, z);
      const westFx = (west - field.originLng) * m.lng;
      const eastFx = (east - field.originLng) * m.lng;
      const northFy = (north - field.originLat) * m.lat;
      const southFy = (south - field.originLat) * m.lat;
      tiles.push({
        z,
        x,
        y,
        svgX: westFx,
        svgY: field.heightM - northFy,
        widthM: eastFx - westFx,
        heightM: northFy - southFy,
      });
    }
  }
  return tiles;
}

export function barnPlanSatOverlayTiles(field: {
  originLat: number;
  originLng: number;
  widthM: number;
  heightM: number;
}): BarnPlanSatTile[] {
  if (
    !Number.isFinite(field.originLat) ||
    !Number.isFinite(field.originLng) ||
    !Number.isFinite(field.widthM) ||
    !Number.isFinite(field.heightM) ||
    field.widthM < 1 ||
    field.heightM < 1
  ) {
    return [];
  }
  let z = barnPlanSatZoomForField(field.widthM, field.heightM, field.originLat);
  let tiles = tilesAtZoom(field, z);
  while (tiles.length > BARN_PLAN_SAT_MAX_TILES && z > BARN_PLAN_SAT_MIN_Z) {
    z -= 1;
    tiles = tilesAtZoom(field, z);
  }
  return tiles.slice(0, BARN_PLAN_SAT_MAX_TILES);
}
