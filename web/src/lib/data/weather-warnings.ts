import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  farmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { matchWarningsForFarm } from "@/lib/kma/kma-wrn-match";

export type WeatherWarningRow = {
  id: string;
  farmKey: FarmKey;
  farmLabel: string;
  sido: string;
  sigungu: string;
  typeLabel: string;
  levelLabel: string;
  severity: "warning" | "critical";
  detail: string;
  occurredAt: string;
  matchReason: "regId" | "name";
  source: "기상청";
};

type CacheRow = {
  fetched_at: string;
  tm_fc: number | null;
  raw_items: Record<string, unknown>[] | null;
  fetch_ok: boolean;
};

function tmFcToIso(tmFc: number | string | null, fallback: string): string {
  if (tmFc == null) return fallback;
  const s = String(tmFc).padStart(12, "0");
  if (s.length < 12) return fallback;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export async function fetchWeatherWarnCache(): Promise<CacheRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weather_warn_cache")
    .select("fetched_at, tm_fc, raw_items, fetch_ok")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  return data as CacheRow;
}

export function buildWeatherWarningsForLocations(
  locations: FarmLocationRow[],
  cache: CacheRow | null
): WeatherWarningRow[] {
  if (!cache?.fetch_ok || !cache.raw_items?.length) return [];

  const items = cache.raw_items;
  const fetchedAt = cache.fetched_at;
  const rows: WeatherWarningRow[] = [];

  for (const loc of locations) {
    const matches = matchWarningsForFarm(items, loc.sido, loc.sigungu);
    const farmLabel = farmShortLabel(loc.farmKey);

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const typeLabel =
        m.typeLabel ||
        extractTypeFromDetail(m.detail) ||
        "기상특보";
      const levelLabel =
        m.levelLabel || extractLevelFromDetail(m.detail) || "주의보";

      rows.push({
        id: `wrn:${farmKeyId(loc.farmKey)}:${i}:${m.tmFc ?? ""}`,
        farmKey: loc.farmKey,
        farmLabel,
        sido: loc.sido,
        sigungu: loc.sigungu,
        typeLabel,
        levelLabel,
        severity: levelLabel === "경보" ? "critical" : "warning",
        detail: m.detail,
        occurredAt: tmFcToIso(m.tmFc, fetchedAt),
        matchReason: m.matchReason,
        source: "기상청",
      });
    }
  }

  return rows.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

function extractTypeFromDetail(detail: string): string {
  const m = detail.match(
    /(강풍|호우|한파|건조|폭풍해일|지진해일|풍랑|태풍|대설|황사|폭염|안개)/
  );
  return m?.[1] ?? "";
}

function extractLevelFromDetail(detail: string): string {
  if (/경보/u.test(detail)) return "경보";
  if (/주의보/u.test(detail)) return "주의보";
  return "";
}
