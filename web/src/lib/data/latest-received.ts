import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** 요청당 1회 조회 — TopBar 마지막 수신 표시용 */
export const getLatestReceivedAt = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("iot_room_state_raw")
    .select("received_at")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.received_at) return null;
  return String(data.received_at);
});
