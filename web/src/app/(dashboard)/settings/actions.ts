"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveBarnMetas, type BarnMeta } from "@/lib/data/barn-meta";
import {
  saveControllerMetas,
  type ControllerMetaEntry,
} from "@/lib/data/controller-meta";

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

export async function saveControllerMetasAction(formData: FormData) {
  const raw = String(formData.get("controllers_json") ?? "[]");
  let controllers: ControllerMetaEntry[];
  try {
    controllers = JSON.parse(raw) as ControllerMetaEntry[];
    if (!Array.isArray(controllers)) throw new Error("invalid");
  } catch {
    redirect("/settings?tab=controller&error=invalid");
  }

  const result = await saveControllerMetas(controllers);
  if (!result.ok) {
    redirect("/settings?tab=controller&error=save");
  }

  revalidatePath("/controllers");
  revalidatePath("/settings");
  redirect("/settings?tab=controller&ok=saved");
}
