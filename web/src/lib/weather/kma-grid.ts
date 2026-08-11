import type { KmaGrid } from "@/lib/weather/kma-types";

/** KMA DFS 격자 — LAMBERT conformal conic (기상청 동네예보 격자) */
const RE = 6371.00877;
const GRID = 5.0;
const SLAT1 = (30.0 * Math.PI) / 180;
const SLAT2 = (60.0 * Math.PI) / 180;
const OLON = (126.0 * Math.PI) / 180;
const OLAT = (38.0 * Math.PI) / 180;
const XO = 43;
const YO = 136;

export function latLngToGrid(lat: number, lng: number): KmaGrid {
  const degrad = Math.PI / 180;
  const re = RE / GRID;
  let sn =
    Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) /
    Math.tan(Math.PI * 0.25 + SLAT1 * 0.5);
  sn = Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + SLAT1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(SLAT1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + OLAT * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const ra = Math.tan(Math.PI * 0.25 + lat * degrad * 0.5);
  const raScaled = (re * sf) / Math.pow(ra, sn);
  let theta = lng * degrad - OLON;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const x = Math.floor(raScaled * Math.sin(theta) + XO + 0.5);
  const y = Math.floor(ro - raScaled * Math.cos(theta) + YO + 0.5);
  return { nx: x, ny: y };
}
