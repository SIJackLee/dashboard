"use server";

import { revalidatePath } from "next/cache";
import type { FarmKey } from "@/lib/data/farm-key";
import { getFarmTrendAllPeriods } from "@/lib/data/farm-trend-history";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import {
  clearBarnLayouts,
  getBarnLayoutPrefs,
  mergeBarnLayouts,
  patchBarnLayouts,
  saveBarnLayouts,
} from "@/lib/data/barn-meta";

/** Admin hub — 선택 농장 추이 그래프 (클라이언트 fetch용). */
export async function fetchFarmTrendAllPeriodsAction(
  farmKey: FarmKey
): Promise<Record<TrendPeriodId, TrendPeriodData>> {
  return getFarmTrendAllPeriods({ farmKey });
}

export async function saveBarnGridsAction(
  grids: { catalogKey: string; col: number; row: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const prefs = await getBarnLayoutPrefs();
  const layouts = { ...prefs.layouts };
  for (const g of grids) {
    if (!g.catalogKey) continue;
    layouts[g.catalogKey] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const result = await saveBarnLayouts(layouts);
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}

/** 드래그 — 변경된 카드만 patch (revalidate·refresh 없음) */
export async function patchBarnGridsAction(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  return patchBarnLayouts(partial);
}

/** 최초·신규 SP 자동 배치 좌표 영구 저장 */
export async function persistBarnLayoutsAction(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  const result = await mergeBarnLayouts(partial);
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}

/** SP 카드 위치 SP01~ 순 자동 배치로 되돌림 */
export async function resetBarnLayoutsAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const result = await clearBarnLayouts();
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}
