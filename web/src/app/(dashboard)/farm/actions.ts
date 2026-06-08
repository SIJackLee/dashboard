"use server";

import { revalidatePath } from "next/cache";
import { getBarnMetas, saveBarnMetas } from "@/lib/data/barn-meta";

export async function saveBarnGridsAction(
  grids: { id: string; col: number; row: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const metas = await getBarnMetas();
  if (metas.length === 0) return { ok: false, error: "empty" };

  const gridMap = new Map(grids.map((g) => [g.id, g]));
  const updated = metas.map((m) => {
    const g = gridMap.get(m.id);
    if (!g) return m;
    return {
      ...m,
      grid: {
        col: Math.max(1, Math.min(4, g.col)),
        row: Math.max(1, Math.min(4, g.row)),
      },
    };
  });

  const result = await saveBarnMetas(updated, false);
  if (result.ok) {
    revalidatePath("/farm");
    revalidatePath("/settings");
  }
  return result;
}
