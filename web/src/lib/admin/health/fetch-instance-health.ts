import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPTY_INSTANCE_SUMMARY,
  summarizeInstanceHealth,
  type InstanceHealthRow,
  type InstanceHealthSummary,
} from "@/lib/admin/health/instance-health-map";

export {
  summarizeInstanceHealth,
  type InstanceHealthRow,
  type InstanceHealthSummary,
} from "@/lib/admin/health/instance-health-map";

/** instance_health_current 최신 1행 조회 후 요약. 실패/미적재 시 빈 요약(폴백 유도). */
export async function fetchInstanceHealth(
  admin: ReturnType<typeof createAdminClient>,
  nowMs: number = Date.now(),
): Promise<InstanceHealthSummary> {
  try {
    const { data, error } = await admin
      .from("instance_health_current")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return EMPTY_INSTANCE_SUMMARY;
    return summarizeInstanceHealth(data as InstanceHealthRow, nowMs);
  } catch {
    return EMPTY_INSTANCE_SUMMARY;
  }
}
