import "server-only";

import { createClient } from "@/lib/supabase/server";

import { barnCatalogKey } from "@/lib/data/barn-catalog";
import { resolveBarnGridCollisions } from "@/lib/data/barn-grid";

import {
  DEFAULT_FARM,
  parseFarmKeyFields,
  type FarmKey,
} from "@/lib/data/farm-key";



export type BarnMetaType = "barn" | "office";



export type BarnMeta = {

  id: string;

  farmKey: FarmKey;

  moduleUid: number;

  /** 통신박스 전송 축사(칸) 식별자 (decoded_json.stallNo) */

  stallNo: string;

  name: string;

  grid: { col: number; row: number };

  type?: BarnMetaType;

};



export type BarnLayoutPrefs = {
  layouts: Record<string, { col: number; row: number }>;
  aliases: Record<string, string>;
  /** legacy ui_config.barns — layout 마이그레이션용 */
  legacyBarns: BarnMeta[];
};

export type UiConfig = {
  barns: BarnMeta[];
  barnLayouts?: Record<string, { col: number; row: number }>;
  barnAliases?: Record<string, string>;
};

const EMPTY_CONFIG: UiConfig = { barns: [] };



function parseUiConfig(raw: unknown): UiConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CONFIG;

  const obj = raw as Record<string, unknown>;

  const barns = Array.isArray(obj.barns)
    ? obj.barns
        .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
        .map(normalizeBarnMeta)
        .filter((b): b is BarnMeta => b !== null)
    : [];

  return {
    barns,
    barnLayouts: parseLayoutRecord(obj.barnLayouts),
    barnAliases: parseAliasRecord(obj.barnAliases),
  };
}



function normalizeBarnMeta(raw: Record<string, unknown>): BarnMeta | null {

  const id = String(raw.id ?? "").trim();

  const farmKey = parseFarmKeyFields(raw) ?? DEFAULT_FARM;

  const moduleUid = Number(raw.moduleUid ?? raw.module_uid);

  const stallNo = String(raw.stallNo ?? raw.stall_no ?? "").trim();

  const name = String(raw.name ?? "").trim() || (stallNo ? `${stallNo}축사` : "");

  if (!id || !stallNo || !name || !Number.isInteger(moduleUid)) {

    return null;

  }

  const gridRaw = (raw.grid ?? {}) as Record<string, unknown>;

  const col = Math.max(1, Math.min(4, Number(gridRaw.col) || 1));

  const row = Math.max(1, Math.min(4, Number(gridRaw.row) || 1));

  const type =

    raw.type === "office" ? "office" : raw.type === "barn" ? "barn" : undefined;

  return {

    id,

    farmKey,

    moduleUid,

    stallNo,

    name,

    grid: { col, row },

    type,

  };

}



function normalizeBarnMetas(barns: BarnMeta[]): BarnMeta[] {

  return barns.map((b, i) => ({

    ...b,

    id: b.id || `barn-${i + 1}`,

    stallNo: b.stallNo.trim(),

    name: b.name.trim() || `${b.stallNo.trim()}축사`,

    grid: {

      col: Math.max(1, Math.min(4, b.grid.col)),

      row: Math.max(1, Math.min(4, b.grid.row)),

    },

  }));

}



export function validateBarnMetas(

  barns: BarnMeta[],

  resolveCollisions = true

): BarnMeta[] {

  const normalized = normalizeBarnMetas(barns);

  return resolveCollisions

    ? resolveBarnGridCollisions(normalized)

    : normalized;

}



/** 현재 사용자 profiles.ui_config 에서 축사 메타데이터 로드 */

export async function getBarnMetas(): Promise<BarnMeta[]> {

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return [];



  const { data, error } = await supabase

    .from("profiles")

    .select("ui_config")

    .eq("user_id", user.id)

    .maybeSingle();



  if (error || !data) return [];

  return resolveBarnGridCollisions(parseUiConfig(data.ui_config).barns);

}



/** 축사 메타데이터 저장 (본인 profiles.ui_config) */

export async function saveBarnMetas(

  barns: BarnMeta[],

  resolveCollisions = true

): Promise<{ ok: boolean; error?: string }> {

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "unauthorized" };



  const validated = validateBarnMetas(barns, resolveCollisions);



  const { data: existing, error: loadErr } = await supabase

    .from("profiles")

    .select("ui_config")

    .eq("user_id", user.id)

    .maybeSingle();



  if (loadErr) return { ok: false, error: loadErr.message };



  const prev =

    existing?.ui_config && typeof existing.ui_config === "object"

      ? (existing.ui_config as Record<string, unknown>)

      : {};



  const ui_config = { ...prev, barns: validated };



  const { error } = await supabase

    .from("profiles")

    .update({ ui_config })

    .eq("user_id", user.id);



  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

function parseLayoutRecord(
  raw: unknown
): Record<string, { col: number; row: number }> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { col: number; row: number }> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const g = val as Record<string, unknown>;
    const col = Number(g.col);
    const row = Number(g.row);
    if (Number.isFinite(col) && Number.isFinite(row)) {
      out[key] = {
        col: Math.max(1, Math.min(8, col)),
        row: Math.max(1, Math.min(8, row)),
      };
    }
  }
  return out;
}

function parseAliasRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const s = String(val ?? "").trim();
    if (s) out[key] = s;
  }
  return out;
}

function migrateLegacyBarnsToLayouts(
  barns: BarnMeta[]
): Record<string, { col: number; row: number }> {
  const layouts: Record<string, { col: number; row: number }> = {};
  for (const b of barns) {
    const key = barnCatalogKey(b.farmKey, b.moduleUid, null);
    layouts[key] = { col: b.grid.col, row: b.grid.row };
  }
  return layouts;
}

/** 지도 레이아웃·별칭 (자동 축사 카드용) */
export async function getBarnLayoutPrefs(): Promise<BarnLayoutPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { layouts: {}, aliases: {}, legacyBarns: [] };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { layouts: {}, aliases: {}, legacyBarns: [] };
  }

  const cfg = parseUiConfig(data.ui_config);
  const legacyBarns = resolveBarnGridCollisions(cfg.barns);
  const layouts = {
    ...migrateLegacyBarnsToLayouts(legacyBarns),
    ...(cfg.barnLayouts ?? {}),
  };
  return {
    layouts,
    aliases: cfg.barnAliases ?? {},
    legacyBarns,
  };
}

/** catalogKey 기준 그리드 위치 저장 */
export async function saveBarnLayouts(
  layouts: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    existing?.ui_config && typeof existing.ui_config === "object"
      ? (existing.ui_config as Record<string, unknown>)
      : {};

  const normalized: Record<string, { col: number; row: number }> = {};
  for (const [key, g] of Object.entries(layouts)) {
    normalized[key] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const ui_config = { ...prev, barnLayouts: normalized };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 신규 SP 자동 배치 좌표를 기존 layouts에 병합 저장 */
export async function mergeBarnLayouts(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(partial).length === 0) return { ok: true };
  const prefs = await getBarnLayoutPrefs();
  return saveBarnLayouts({ ...prefs.layouts, ...partial });
}

/** 변경된 카드만 1회 read·write (드래그 저장용) */
export async function patchBarnLayouts(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(partial).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    existing?.ui_config && typeof existing.ui_config === "object"
      ? (existing.ui_config as Record<string, unknown>)
      : {};

  const prevLayouts =
    prev.barnLayouts && typeof prev.barnLayouts === "object"
      ? (prev.barnLayouts as Record<string, { col: number; row: number }>)
      : {};

  const nextLayouts = { ...prevLayouts };
  for (const [key, g] of Object.entries(partial)) {
    nextLayouts[key] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config: { ...prev, barnLayouts: nextLayouts } })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 농장 지도 SP 카드 위치 초기화 (이후 자동 SP 순 배치) */
export async function clearBarnLayouts(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    existing?.ui_config && typeof existing.ui_config === "object"
      ? (existing.ui_config as Record<string, unknown>)
      : {};

  const ui_config = {
    ...prev,
    barnLayouts: {},
    barns: [],
  };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
