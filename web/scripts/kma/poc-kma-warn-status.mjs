#!/usr/bin/env node
/**
 * KMA 기상특보 PoC — getPwnStatus + farm_location 매칭 검증
 * Usage: node scripts/kma/poc-kma-warn-status.mjs [--offline]
 */
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  fetchPwnStatus,
  fetchPwnCd,
  probeEndpoint,
  parseKmaResponse,
} from "./kma-api-client.mjs";
import { WTHR_WRN_OPS } from "../../src/lib/kma/kma-api-config.ts";
import {
  formatWarning,
  matchFarmsToWarnings,
} from "../../src/lib/kma/kma-wrn-match.ts";
import { loadRegIdMapFromFile } from "../../src/lib/kma/kma-wrn-match-node.ts";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../../.env.local"),
});

const __dir = dirname(fileURLToPath(import.meta.url));
const offline = process.argv.includes("--offline");
const key = process.env.DATA_GO_KR_SERVICE_KEY?.trim();

const SAMPLE_FARMS = [
  { id: "FARM01/P00", sido: "인천광역시", sigungu: "남동구" },
  { id: "FARM33/P00", sido: "경기도", sigungu: "수원시" },
  { id: "FARM37/P00", sido: "서울특별시", sigungu: "강남구" },
];

function loadSeedFarms() {
  const manifest = join(
    __dir,
    "../../../../RSD/scripts/fixtures/farm-location-seed-20260608-manifest.json"
  );
  try {
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    return SAMPLE_FARMS.map((sample) => {
      const row = data.rows.find(
        (r) =>
          r.lsind_regist_no === sample.id.split("/")[0] &&
          r.item_code === sample.id.split("/")[1]
      );
      return row
        ? {
            id: sample.id,
            sido: row.sido,
            sigungu: row.sigungu,
          }
        : sample;
    });
  } catch {
    return SAMPLE_FARMS;
  }
}

async function main() {
  const report = {
    ranAt: new Date().toISOString(),
    mode: offline ? "offline-fixture" : key ? "live" : "probe-only",
    apiKeyPresent: Boolean(key),
    probes: {},
    pwnStatus: null,
    pwnCd: null,
    farms: [],
    goNoGo: null,
    blockers: [],
    notes: [],
  };

  report.probes.pwnStatus = await probeEndpoint(WTHR_WRN_OPS.pwnStatus);
  report.probes.pwnCd = await probeEndpoint(WTHR_WRN_OPS.pwnCd);

  let warnings = [];

  if (offline) {
    const fixture = JSON.parse(
      readFileSync(join(__dir, "fixtures/sample-pwn-status.json"), "utf8")
    );
    const parsed = parseKmaResponse(fixture);
    warnings = parsed.items;
    report.pwnStatus = {
      ok: parsed.ok,
      source: "fixture",
      itemCount: parsed.items.length,
      items: parsed.items.map(formatWarning),
    };
    report.notes.push("offline fixture — regId/name 매칭 로직만 검증");
  } else if (key) {
    const status = await fetchPwnStatus(key);
    report.pwnStatus = {
      ok: status.ok,
      resultCode: status.resultCode,
      resultMsg: status.resultMsg,
      httpStatus: status.httpStatus,
      itemCount: status.items.length,
      sample: status.items.slice(0, 5),
    };

    if (!status.ok) {
      report.blockers.push(
        `getPwnStatus failed: ${status.resultCode} ${status.resultMsg}`
      );
    } else {
      warnings = status.items;
    }

    const cd = await fetchPwnCd(key);
    report.pwnCd = {
      ok: cd.ok,
      resultCode: cd.resultCode,
      itemCount: cd.items.length,
    };
  } else {
    report.blockers.push(
      "DATA_GO_KR_SERVICE_KEY 없음 — scripts/kma/apply-data-go-kr.md 참고"
    );
    report.notes.push("probe-only: endpoint reachable + Unauthorized 확인");
  }

  const map = loadRegIdMapFromFile(join(__dir, "wrn-reg-id-map.json"));
  const mappedCount = map.filter((e) => e.regId).length;
  const mapTotal = map.length;
  const mapRatio = mapTotal > 0 ? mappedCount / mapTotal : 0;
  report.regIdMap = {
    total: mapTotal,
    withRegId: mappedCount,
    ratio: Math.round(mapRatio * 1000) / 10,
  };

  if (warnings.length > 0) {
    const farms = loadSeedFarms();
    report.farms = matchFarmsToWarnings(farms, warnings).map((row) => ({
      farmId: row.farm.id,
      sido: row.farm.sido,
      sigungu: row.farm.sigungu,
      warningCount: row.warnings.length,
      warnings: row.warnings,
    }));
  }

  const endpointOk =
    report.probes.pwnStatus.reachable && report.probes.pwnStatus.unauthorized;
  const liveOk = report.pwnStatus?.ok === true;
  const mapOk = mapRatio >= 0.8 || offline;
  const logicOk =
    offline || (report.farms.length > 0 && report.pwnStatus?.ok !== false);

  if (offline) {
    report.goNoGo = "GO (offline logic verified — live key pending)";
  } else if (liveOk && mapOk) {
    report.goNoGo = "GO";
  } else if (endpointOk && !key) {
    report.goNoGo = "CONDITIONAL GO — API 활용 가능, ServiceKey 발급 후 live 재실행";
  } else if (liveOk && !mapOk) {
    report.goNoGo = "CONDITIONAL GO — 특보 조회 OK, build-wrn-reg-id-map 재실행 필요";
  } else {
    report.goNoGo = "NO-GO";
  }

  const outPath = join(__dir, "poc-results.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("=== KMA Weather Warning PoC ===");
  console.log(`mode: ${report.mode}`);
  console.log(`goNoGo: ${report.goNoGo}`);
  console.log(`pwnStatus probe: HTTP ${report.probes.pwnStatus.httpStatus}`);
  if (report.pwnStatus?.itemCount != null) {
    console.log(`active warnings: ${report.pwnStatus.itemCount}`);
  }
  console.log(`regId map: ${mappedCount}/${mapTotal} (${report.regIdMap.ratio}%)`);
  for (const f of report.farms) {
    console.log(
      `  ${f.farmId} (${f.sigungu}): ${f.warningCount} warning(s)`
    );
  }
  if (report.blockers.length) {
    console.log("blockers:", report.blockers.join("; "));
  }
  console.log(`report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
