import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveBarnGridCollisions } from "@/lib/data/barn-grid";

export type BarnMetaType = "barn" | "office";

export type BarnMeta = {
  id: string;
  farmUid: number;
  moduleUid: number;
  /** 통신모듈 전송 축사(칸) 식별자 (decoded_json.stallNo) */
  stallNo: string;
  name: string;
  grid: { col: number; row: number };
  type?: BarnMetaType;
};

export type UiConfig = {
  barns: BarnMeta[];
};

const EMPTY_CONFIG: UiConfig = { barns: [] };

function parseUiConfig(raw: unknown): UiConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CONFIG;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.barns)) return EMPTY_CONFIG;
  const barns = obj.barns
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map(normalizeBarnMeta)
    .filter((b): b is BarnMeta => b !== null);
  return { barns };
}

function normalizeBarnMeta(raw: Record<string, unknown>): BarnMeta | null {
  const id = String(raw.id ?? "").trim();
  const farmUid = Number(raw.farmUid ?? raw.farm_uid);
  const moduleUid = Number(raw.moduleUid ?? raw.module_uid);
  const stallNo = String(raw.stallNo ?? raw.stall_no ?? "").trim();
  const name = String(raw.name ?? "").trim() || (stallNo ? `${stallNo}축사` : "");
  if (
    !id ||
    !stallNo ||
    !name ||
    !Number.isInteger(farmUid) ||
    !Number.isInteger(moduleUid)
  ) {
    return null;
  }
  const gridRaw = (raw.grid ?? {}) as Record<string, unknown>;
  const col = Math.max(1, Math.min(4, Number(gridRaw.col) || 1));
  const row = Math.max(1, Math.min(4, Number(gridRaw.row) || 1));
  const type =
    raw.type === "office" ? "office" : raw.type === "barn" ? "barn" : undefined;
  return {
    id,
    farmUid,
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
  const ui_config: UiConfig = { barns: validated };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
