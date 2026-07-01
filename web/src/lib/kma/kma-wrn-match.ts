import regMapPayload from "@/lib/kma/wrn-reg-id-map.json";
import { WRN_LEVEL_LABEL, WRN_TYPE_LABEL } from "@/lib/kma/kma-api-config";

export type RegMapEntry = {
  regId: string | null;
  sido: string;
  sigungu: string;
  regName?: string | null;
  source?: string;
  matchScore?: number;
};

const regMapEntries: RegMapEntry[] = Array.isArray(regMapPayload)
  ? regMapPayload
  : (regMapPayload as { entries?: RegMapEntry[] }).entries ?? [];

export function loadRegIdMap(): RegMapEntry[] {
  return regMapEntries;
}

export function normalizeSigungu(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "")
    .replace(/(특별자치)?(시|도|광역시)$/u, "")
    .replace(/(시|군|구)$/u, "");
}

export function canonicalSido(sido: string): string {
  const aliases: Record<string, string> = {
    강원도: "강원특별자치도",
    전라북도: "전북특별자치도",
  };
  return aliases[sido.trim()] ?? sido.trim();
}

export function regIdForFarm(
  sido: string,
  sigungu: string,
  map: RegMapEntry[] = loadRegIdMap()
): string | null {
  const canon = canonicalSido(sido);
  const norm = normalizeSigungu(sigungu);
  const exact = map.find(
    (e) => e.sido === canon && e.sigungu === sigungu.trim()
  );
  if (exact?.regId) return exact.regId;
  const fuzzy = map.find(
    (e) =>
      e.sido === canon &&
      (normalizeSigungu(e.sigungu) === norm ||
        normalizeSigungu(e.regName ?? e.sigungu) === norm)
  );
  return fuzzy?.regId ?? null;
}

function warningRegId(item: Record<string, unknown>): string | null {
  const v =
    item.regId ??
    item.reg_id ??
    item.areaCode ??
    item.area_code ??
    null;
  return v != null ? String(v) : null;
}

function warningStrings(item: Record<string, unknown>): string[] {
  return Object.values(item).filter(
    (v): v is string => typeof v === "string" && v.length >= 2
  );
}

const SEA_AREA_RE = /바다|해역|먼바다|앞바다|해안/u;
const MIN_NAME_MATCH_LEN = 3;

function nameFallbackHit(sigunguNorm: string, text: string): boolean {
  if (sigunguNorm.length < MIN_NAME_MATCH_LEN) return false;
  if (SEA_AREA_RE.test(text)) return false;
  const n = normalizeSigungu(text);
  if (n.length < MIN_NAME_MATCH_LEN) return false;
  return n.includes(sigunguNorm) || sigunguNorm.includes(n);
}

export type MatchedWarning = {
  regId: string | null;
  typeCode: string;
  typeLabel: string;
  level: string;
  levelLabel: string;
  tmFc: number | string | null;
  stnId: string | null;
  matchReason: "regId" | "name";
  detail: string;
};

export function formatWarning(item: Record<string, unknown>): Omit<
  MatchedWarning,
  "matchReason" | "detail"
> {
  const wrn = String(item.wrn ?? item.WRN ?? item.wrnTp ?? "");
  const lvl = String(item.lvl ?? item.LVL ?? item.level ?? "");
  return {
    regId: warningRegId(item),
    typeCode: wrn,
    typeLabel: WRN_TYPE_LABEL[wrn] ?? wrn,
    level: lvl,
    levelLabel: WRN_LEVEL_LABEL[lvl] ?? lvl,
    tmFc: (item.tmFc ?? item.tm_fc ?? null) as number | string | null,
    stnId:
      item.stnId != null || item.stn_id != null
        ? String(item.stnId ?? item.stn_id)
        : null,
  };
}

export function matchWarningsForFarm(
  warnings: Record<string, unknown>[],
  sido: string,
  sigungu: string,
  map: RegMapEntry[] = loadRegIdMap()
): MatchedWarning[] {
  const regId = regIdForFarm(sido, sigungu, map);
  const sigunguNorm = normalizeSigungu(sigungu);
  const matched: MatchedWarning[] = [];

  for (const item of warnings) {
    const formatted = formatWarning(item);
    const itemRegId = warningRegId(item);
    let reason: "regId" | "name" | null = null;

    if (regId && itemRegId && regId === itemRegId) {
      reason = "regId";
    } else {
      const hit = warningStrings(item).some((s) =>
        nameFallbackHit(sigunguNorm, s)
      );
      if (hit) reason = "name";
    }

    if (reason) {
      const detail = warningStrings(item)
        .filter((s) => /주의보|경보/u.test(s))
        .join(" ")
        .slice(0, 200);
      matched.push({
        ...formatted,
        matchReason: reason,
        detail: detail || `${sigungu} 관련 특보`,
      });
    }
  }

  return matched;
}
