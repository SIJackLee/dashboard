import "server-only";

import { mergeProfileUiConfig } from "@/lib/data/profile-ui-config";
import { createClient } from "@/lib/supabase/server";

export function isValidPiggyPlayerId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length >= 2 &&
    id.length <= 20 &&
    /^[a-zA-Z0-9가-힣 _-]+$/.test(id)
  );
}

export async function getPiggyPlayerId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  const cfg = data.ui_config as Record<string, unknown> | null;
  const id = cfg?.piggyPlayerId;
  return isValidPiggyPlayerId(id) ? id : null;
}

export async function savePiggyPlayerId(
  playerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPiggyPlayerId(playerId)) {
    return { ok: false, error: "invalid" };
  }

  return mergeProfileUiConfig((prev) => ({
    ...prev,
    piggyPlayerId: playerId.trim(),
  }));
}
