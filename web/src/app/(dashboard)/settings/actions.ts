"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveBarnMetas, type BarnMeta } from "@/lib/data/barn-meta";

export async function saveBarnMetasAction(formData: FormData) {
  const raw = String(formData.get("barns_json") ?? "[]");
  let barns: BarnMeta[];
  try {
    barns = JSON.parse(raw) as BarnMeta[];
    if (!Array.isArray(barns)) throw new Error("invalid");
  } catch {
    redirect("/settings?tab=barn&error=invalid");
  }

  const result = await saveBarnMetas(barns);
  if (!result.ok) {
    redirect("/settings?tab=barn&error=save");
  }

  revalidatePath("/farm");
  revalidatePath("/settings");
  redirect("/settings?tab=barn&ok=saved");
}
