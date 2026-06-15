import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  parseControllerMeta,
  type ControllerMetaEntry,
} from "@/lib/data/controller-meta-shared";

export type {
  ControllerMetaConfig,
  ControllerMetaEntry,
} from "@/lib/data/controller-meta-shared";

export { controllerDisplayName } from "@/lib/data/controller-meta-shared";

export async function getControllerMetas(): Promise<ControllerMetaEntry[]> {
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
  const cfg = data.ui_config as Record<string, unknown> | null;
  return parseControllerMeta(cfg).controllers;
}

export async function upsertControllerDisplayName(
  controllerKey: string,
  eqpmnNo: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const metas = await getControllerMetas();
  const trimmed = displayName.trim();
  const next = metas.filter((m) => m.controllerKey !== controllerKey);
  if (trimmed) {
    next.push({ controllerKey, eqpmnNo, displayName: trimmed });
  }
  next.sort((a, b) => a.controllerKey.localeCompare(b.controllerKey));
  return saveControllerMetas(next);
}

export async function saveControllerMetas(
  controllers: ControllerMetaEntry[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    data?.ui_config && typeof data.ui_config === "object"
      ? (data.ui_config as Record<string, unknown>)
      : {};

  const ui_config = {
    ...prev,
    controllers: controllers.filter((c) => c.displayName.trim().length > 0),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
