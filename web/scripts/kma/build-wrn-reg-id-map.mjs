#!/usr/bin/env node
/**
 * korea-regions.json + (선택) FcstZoneInfoService → wrn-reg-id-map.json
 * Usage: node scripts/kma/build-wrn-reg-id-map.mjs
 */
import dotenv from "dotenv";
import { writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchFcstZoneCodes, fetchFcstZoneProbe } from "./kma-api-client.mjs";
import { canonicalSido, normalizeSigungu } from "../../src/lib/kma/kma-wrn-match.ts";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../../.env.local"),
});

const __dir = dirname(fileURLToPath(import.meta.url));
const regionsPath = join(__dir, "../../src/lib/geo/korea-regions.json");
const outPath = join(__dir, "wrn-reg-id-map.json");
const srcOutPath = join(__dir, "../../src/lib/kma/wrn-reg-id-map.json");

function loadRegions() {
  return JSON.parse(readFileSync(regionsPath, "utf8"));
}

function scoreZoneName(regName, sigungu) {
  const rn = normalizeSigungu(regName);
  const sg = normalizeSigungu(sigungu);
  if (rn === sg) return 100;
  if (regName.trim() === sigungu.trim()) return 95;
  if (regName.includes(sigungu) || sigungu.includes(regName)) return 80;
  if (rn.includes(sg) || sg.includes(rn)) return 70;
  return 0;
}

function buildFromFcstZones(regions, zones) {
  const landZones = zones.filter((z) => {
    const sp = z.regSp ?? "";
    return /^[ABC]/i.test(sp) || !/^[HIJKLM]/i.test(sp);
  });

  const entries = [];
  const unmatched = [];

  for (const region of regions) {
    const canon = canonicalSido(region.sido);
    let best = null;
    let bestScore = 0;

    for (const zone of landZones) {
      const name = zone.regName ?? zone.regKo ?? "";
      const score = scoreZoneName(name, region.sigungu);
      if (score > bestScore) {
        bestScore = score;
        best = zone;
      }
    }

    if (best && bestScore >= 70) {
      entries.push({
        regId: best.regId,
        sido: canon,
        sigungu: region.sigungu,
        regName: best.regName,
        source: "FcstZoneInfoService/getFcstZoneCd",
        matchScore: bestScore,
      });
    } else {
      unmatched.push({ sido: canon, sigungu: region.sigungu });
      entries.push({
        regId: null,
        sido: canon,
        sigungu: region.sigungu,
        regName: null,
        source: "unmatched",
        matchScore: 0,
      });
    }
  }

  return { entries, unmatched };
}

function buildOfflineStub(regions) {
  return regions.map((r) => ({
    regId: null,
    sido: canonicalSido(r.sido),
    sigungu: r.sigungu,
    regName: r.sigungu,
    source: "korea-regions-only (API key 없음 — FcstZone 빌드 필요)",
    matchScore: 0,
  }));
}

async function main() {
  const regions = loadRegions();
  const key = process.env.DATA_GO_KR_SERVICE_KEY?.trim();

  let entries;
  let unmatched = [];
  let mode;

  if (key) {
    console.log("Fetching FcstZoneInfoService/getFcstZoneCd …");
    const probe = await fetchFcstZoneProbe(key);
    if (!probe.ok) {
      console.warn(
        `  API error: HTTP ${probe.httpStatus ?? "?"} — ${probe.resultCode} ${probe.resultMsg}`
      );
      if (probe.httpStatus === 403) {
        console.warn(
          "  getFcstZoneCd는 regSp(지상코드) 파라미터가 필요합니다. 클라이언트 기본값 regSp=A 확인."
        );
      }
    }
    const zones = probe.ok ? await fetchFcstZoneCodes(key) : [];
    console.log(`  zones fetched: ${zones.length}`);
    if (zones.length === 0) {
      console.warn(
        "  WARN: 0 zones — FcstZoneInfoService 활용신청·키 확인 필요"
      );
      entries = buildOfflineStub(regions);
      mode = "fallback-stub";
    } else {
      const built = buildFromFcstZones(regions, zones);
      entries = built.entries;
      unmatched = built.unmatched;
      mode = "fcst-zone";
    }
  } else {
    console.warn("DATA_GO_KR_SERVICE_KEY 없음 — stub만 생성");
    entries = buildOfflineStub(regions);
    mode = "offline-stub";
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    entryCount: entries.filter((e) => e.regId).length,
    totalRegions: regions.length,
    unmatchedCount: unmatched.length,
    entries,
    unmatched: unmatched.slice(0, 30),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(srcOutPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Wrote ${outPath} — mapped ${payload.entryCount}/${regions.length} (mode=${mode})`
  );
  console.log(`  also: ${srcOutPath}`);
  if (unmatched.length > 0) {
    console.log(`  unmatched sample: ${unmatched.slice(0, 5).map((u) => u.sigungu).join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
