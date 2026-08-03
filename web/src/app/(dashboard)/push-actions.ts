"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export type UpsertPushDeviceInput = {
  fcmToken: string;
  platform: "android" | "ios";
  appId?: string | null;
  deviceLabel?: string | null;
};

export type UpsertPushDeviceResult =
  | { ok: true }
  | { ok: false; error: string };

/** Capacitor 네이티브에서 받은 FCM 토큰을 user_push_device에 upsert. */
export async function upsertPushDeviceAction(
  input: UpsertPushDeviceInput,
): Promise<UpsertPushDeviceResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const token = input.fcmToken?.trim();
  if (!token) return { ok: false, error: "empty_token" };
  if (input.platform !== "android" && input.platform !== "ios") {
    return { ok: false, error: "invalid_platform" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("user_push_device").upsert(
    {
      user_id: user.id,
      platform: input.platform,
      fcm_token: token,
      app_id: input.appId ?? null,
      device_label: input.deviceLabel ?? null,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "fcm_token" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
