import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { WRN_LEVEL_LABEL, WRN_TYPE_LABEL } from "./kma-api-config.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ regId: string, sido: string, sigungu: string, regName?: string, source: string }} RegMapEntry */

let regMapCache = null;

export function loadRegIdMap(path = join(__dir, "wrn-reg-id-map.json")) {
  if (regMapCache) return regMapCache;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    regMapCache = Array.isArray(data)
      ? data
      : (data.entries ?? []);
  } catch {
    regMapCache = [];
  }
  return regMapCache;
}

export function normalizeSigungu(name) {
  return name
    .trim()
    .replace(/\s+/g, "")
    .replace(/(특별자치)?(시|도|광역시)$/u, "")
    .replace(/(시|군|구)$/u, "");
}

export function canonicalSido(sido) {
  const aliases = {
    강원도: "강원특별자치도",
    전라북도: "전북특별자치도",
  };
  return aliases[sido.trim()] ?? sido.trim();
}

export function regIdForFarm(sido, sigungu, map = loadRegIdMap()) {
  const canon = canonicalSido(sido);
  const norm = normalizeSigungu(sigungu);
  const exact = map.find(
    (e) => e.sido === canon && e.sigungu === sigungu.trim()
  );
  if (exact) return exact.regId;
  const fuzzy = map.find(
    (e) =>
      e.sido === canon &&
      (normalizeSigungu(e.sigungu) === norm ||
        normalizeSigungu(e.regName ?? e.sigungu) === norm)
  );
  return fuzzy?.regId ?? null;
}

function warningRegId(item) {
  return (
    item.regId ??
    item.reg_id ??
    item.areaCode ??
    item.area_code ??
    null
  );
}

function warningStrings(item) {
  return Object.values(item).filter(
    (v) => typeof v === "string" && v.length >= 2
  );
}

const SEA_AREA_RE = /바다|해역|먼바다|앞바다|해안/u;
const MIN_NAME_MATCH_LEN = 3;

export function formatWarning(item) {
  const wrn = item.wrn ?? item.WRN ?? item.wrnTp ?? "";
  const lvl = String(item.lvl ?? item.LVL ?? item.level ?? "");
  const typeLabel = WRN_TYPE_LABEL[wrn] ?? wrn;
  const levelLabel = WRN_LEVEL_LABEL[lvl] ?? lvl;
  return {
    regId: warningRegId(item),
    typeCode: wrn,
    typeLabel,
    level: lvl,
    levelLabel,
    tmFc: item.tmFc ?? item.tm_fc ?? null,
    stnId: item.stnId ?? item.stn_id ?? null,
    raw: item,
  };
}

/**
 * 농장(sido/sigungu)에 해당하는 발효 특보 필터.
 * 1) wrn-reg-id-map regId 매칭
 * 2) 응답 문자열에 sigungu 포함 (fallback)
 */
export function matchWarningsForFarm(warnings, sido, sigungu, map = loadRegIdMap()) {
  const regId = regIdForFarm(sido, sigungu, map);
  const sigunguNorm = normalizeSigungu(sigungu);
  const matched = [];

  for (const item of warnings) {
    const formatted = formatWarning(item);
    const itemRegId = warningRegId(item);
    let reason = null;

    if (regId && itemRegId && regId === itemRegId) {
      reason = "regId";
    } else {
      const hit = warningStrings(item).some((s) => {
        if (SEA_AREA_RE.test(s)) return false;
        const n = normalizeSigungu(s);
        if (n.length < MIN_NAME_MATCH_LEN || sigunguNorm.length < MIN_NAME_MATCH_LEN) {
          return false;
        }
        return n.includes(sigunguNorm) || sigunguNorm.includes(n);
      });
      if (hit) reason = "name";
    }

    if (reason) {
      matched.push({ ...formatted, matchReason: reason });
    }
  }

  return matched;
}

export function matchFarmsToWarnings(farms, warnings, map = loadRegIdMap()) {
  return farms.map((farm) => ({
    farm,
    warnings: matchWarningsForFarm(
      warnings,
      farm.sido,
      farm.sigungu,
      map
    ),
  }));
}
