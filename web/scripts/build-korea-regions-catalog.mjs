/**
 * sigungu-source.json → src/lib/geo/korea-regions.json
 * Source: public gist (시·군·구 centroid, WGS84)
 * Run: node scripts/build-korea-regions-catalog.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "scripts", "sigungu-source.json");
const outPath = join(root, "src", "lib", "geo", "korea-regions.json");

/** 공식 시·도 명칭 (행정구역 개편 반영) */
const CANONICAL_SIDO = {
  강원도: "강원특별자치도",
  전라북도: "전북특별자치도",
};

const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
const rows = [];

for (const [key, coords] of Object.entries(raw)) {
  const slash = key.indexOf("/");
  if (slash <= 0) continue;
  const rawSido = key.slice(0, slash);
  const sigungu = key.slice(slash + 1);
  const sido = CANONICAL_SIDO[rawSido] ?? rawSido;
  const lat = Number(coords.lat);
  const lng = Number(coords.long ?? coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  rows.push({ sido, sigungu, lat: round6(lat), lng: round6(lng) });
}

rows.sort((a, b) => {
  const s = a.sido.localeCompare(b.sido, "ko");
  if (s !== 0) return s;
  return a.sigungu.localeCompare(b.sigungu, "ko");
});

writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Wrote ${rows.length} regions → ${outPath}`);

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
